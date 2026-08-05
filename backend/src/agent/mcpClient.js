import { env } from "../config/env.js";

function headers(sessionId) {
  const h = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (!env.mcpAuthDisabled && env.mcpApiKey) {
    h.Authorization = `Bearer ${env.mcpApiKey}`;
  }
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
  const res = await fetch(`${env.mcpBaseUrl}/mcp`, {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const parsed = parseMcpResponse(text);
  const responseSessionId = res.headers.get("mcp-session-id");
  return { json: parsed, sessionId: responseSessionId || sessionId };
}

export class McpHttpClient {
  constructor() {
    this.sessionId = null;
    this.tools = [];
  }

  async connect() {
    const init = await mcpRequest(null, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "virtual-engineer-agent", version: "0.1.0" },
      },
    });

    this.sessionId = init.sessionId;

    const list = await mcpRequest(this.sessionId, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    this.tools = list.json.result?.tools || [];
    return this.tools;
  }

  async callTool(name, args) {
    const started = Date.now();
    const response = await mcpRequest(this.sessionId, {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    });

    const text = response.json.result?.content?.[0]?.text || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { status: "error", data: text, message: "Failed to parse tool response" };
    }

    return {
      raw: response.json,
      result: parsed,
      latencyMs: Date.now() - started,
    };
  }

  toOpenAiTools() {
    return this.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || tool.name,
        parameters: tool.inputSchema || { type: "object", properties: {} },
      },
    }));
  }

  toAnthropicTools() {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || tool.name,
      input_schema: tool.inputSchema || { type: "object", properties: {} },
    }));
  }
}
