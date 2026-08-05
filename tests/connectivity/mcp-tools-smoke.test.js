#!/usr/bin/env node
/**
 * Connectivity smoke tests for Virtual Engineer MCP server.
 * Requires: npm run mcp:dev (or server running), seeded Atlas data, .env configured.
 */
import { config } from "dotenv";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: join(rootDir, ".env") });

const PORT = process.env.MCP_PORT || 3100;
const BASE = `http://localhost:${PORT}`;
const API_KEY = process.env.MCP_API_KEY || "";
const AUTH_DISABLED = process.env.MCP_AUTH_DISABLED === "true";

function buildHeaders(sessionId) {
  const h = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (!AUTH_DISABLED && API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  if (sessionId) h["mcp-session-id"] = sessionId;
  return h;
}

function parseMcpResponse(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const dataLines = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));
  if (dataLines.length === 0) {
    throw new Error(`Unexpected MCP response: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(dataLines[dataLines.length - 1]);
}

async function mcpRequest(sessionId, body) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: buildHeaders(sessionId),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = parseMcpResponse(text);
  } catch {
    json = { raw: text };
  }
  const responseSessionId = res.headers.get("mcp-session-id") || sessionId;
  return { status: res.status, json, sessionId: responseSessionId };
}

async function createMcpSession() {
  const init = await mcpRequest(null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "connectivity-test", version: "0.1.0" },
    },
  });
  assert.equal(init.status, 200);
  return init.sessionId;
}

describe("MCP connectivity", () => {
  before(async () => {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) {
      throw new Error(`MCP server not reachable at ${BASE}/health — run: npm run mcp:dev`);
    }
  });

  it("health endpoint returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });

  it("lists tools including getChillerById", async () => {
    const sessionId = await createMcpSession();

    const list = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    assert.equal(list.status, 200);
    const tools = list.json?.result?.tools || [];
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("getChillerById"));
    assert.ok(names.includes("getActiveAlarms"));
    assert.ok(names.includes("searchManuals"));
  });

  it("hero scenario CH-ATL-003 returns chiller and active alarms", async () => {
    const sessionId = await createMcpSession();

    const chiller = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "getChillerById",
        arguments: { chiller_id: "CH-ATL-003" },
      },
    });
    assert.equal(chiller.status, 200);
    const chillerText = chiller.json?.result?.content?.[0]?.text || "";
    assert.ok(chillerText.includes("CH-ATL-003"));
    assert.ok(chillerText.includes("30XA"));

    const alarms = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "getActiveAlarms",
        arguments: { chiller_id: "CH-ATL-003" },
      },
    });
    assert.equal(alarms.status, 200);
    const alarmText = alarms.json?.result?.content?.[0]?.text || "";
    assert.ok(alarmText.includes("A1.01"));
  });

  it("DAL scenario CH-DAL-002 returns active alarm 207 and service history", async () => {
    const sessionId = await createMcpSession();

    const alarms = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: {
        name: "getActiveAlarms",
        arguments: { chiller_id: "CH-DAL-002" },
      },
    });
    const alarmText = alarms.json?.result?.content?.[0]?.text || "";
    assert.ok(alarmText.includes("207"));

    const history = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 22,
      method: "tools/call",
      params: {
        name: "getServiceHistory",
        arguments: { chiller_id: "CH-DAL-002" },
      },
    });
    const historyText = history.json?.result?.content?.[0]?.text || "";
    assert.ok(historyText.includes("CH-DAL-002"));
    assert.ok(
      historyText.includes("WO-2025-09432") || historyText.includes("cooling tower")
    );
  });

  it("PHX scenario CH-PHX-005 returns active alarm Co.A1 and prior cases", async () => {
    const sessionId = await createMcpSession();

    const alarms = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 31,
      method: "tools/call",
      params: {
        name: "getActiveAlarms",
        arguments: { chiller_id: "CH-PHX-005" },
      },
    });
    const alarmText = alarms.json?.result?.content?.[0]?.text || "";
    assert.ok(alarmText.includes("Co.A1"));

    const history = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 32,
      method: "tools/call",
      params: {
        name: "getServiceHistory",
        arguments: { chiller_id: "CH-PHX-005" },
      },
    });
    const historyText = history.json?.result?.content?.[0]?.text || "";
    assert.ok(historyText.includes("CH-PHX-005"));
    assert.ok(
      historyText.includes("WO-2025-03120") || historyText.includes("LEN bus")
    );
  });

  it("tool responses include query_insight metadata", async () => {
    const sessionId = await createMcpSession();

    const chiller = await mcpRequest(sessionId, {
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: {
        name: "getChillerById",
        arguments: { chiller_id: "CH-ATL-003" },
      },
    });
    const text = chiller.json?.result?.content?.[0]?.text || "";
    const parsed = JSON.parse(text);
    assert.equal(parsed.query_insight.pattern, "exact_find");
    assert.equal(parsed.query_insight.collection, "chillers");
  });
});

describe("Chat API", () => {
  before(async () => {
    const health = await fetch(`${BASE}/api/health`);
    if (health.status !== 200 && health.status !== 503) {
      throw new Error(`Chat API not reachable — run: npm run mcp:dev`);
    }
  });

  it("chat health endpoint responds", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const hasKey = res.status === 200 || res.status === 503;
    assert.ok(hasKey);
  });
});
