#!/usr/bin/env node
/**
 * Optional Grove LLM connectivity smoke tests.
 * Requires: MDB_GROVE_API_KEY in .env, network access to Grove gateway.
 * MCP server optional for agent dry-run (skipped if not running).
 */
import { config } from "dotenv";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLlmConfig } from "../../backend/src/config/env.js";
import { McpHttpClient } from "../../backend/src/agent/mcpClient.js";
import { runAgent } from "../../backend/src/agent/orchestrator.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: join(rootDir, ".env") });

const GROVE_KEY = process.env.MDB_GROVE_API_KEY || "";
const PORT = process.env.MCP_PORT || 3100;
const BASE = `http://localhost:${PORT}`;

const groveDescribe = GROVE_KEY ? describe : describe.skip;

function groveLlmConfig(provider) {
  const saved = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = provider;
  try {
    return { ...getLlmConfig(), maxSteps: 4 };
  } finally {
    if (saved === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = saved;
    }
  }
}

async function groveChatCompletion(llmConfig, userMessage) {
  const url = `${llmConfig.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: llmConfig.headers,
    body: JSON.stringify({
      model: llmConfig.model,
      messages: [{ role: "user", content: userMessage }],
      stream: false,
      max_tokens: 32,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Grove OpenAI path error ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function groveAnthropicMessage(llmConfig, userMessage) {
  const url = `${llmConfig.baseUrl.replace(/\/$/, "")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: llmConfig.headers,
    body: JSON.stringify({
      model: llmConfig.model,
      max_tokens: 32,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Grove Anthropic path error ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

groveDescribe("Grove LLM connectivity", () => {
  it("getLlmConfig resolves grove-openai with protocol and gateway", () => {
    const llm = groveLlmConfig("grove-openai");
    assert.equal(llm.protocol, "openai");
    assert.equal(llm.gateway, "grove");
    assert.ok(llm.baseUrl.includes("/openai/v1"));
    assert.ok(llm.headers["api-key"]);
  });

  it("getLlmConfig resolves grove-anthropic with protocol and gateway", () => {
    const llm = groveLlmConfig("grove-anthropic");
    assert.equal(llm.protocol, "anthropic");
    assert.equal(llm.gateway, "grove");
    assert.ok(llm.baseUrl.includes("/anthropic/v1"));
    assert.ok(llm.headers["anthropic-version"]);
  });

  it("grove-openai returns a chat completion", async () => {
    const llm = groveLlmConfig("grove-openai");
    const body = await groveChatCompletion(llm, "Reply with exactly: pong");
    const content = body.choices?.[0]?.message?.content || "";
    assert.ok(content.length > 0);
  });

  it("grove-anthropic returns a message", async () => {
    const llm = groveLlmConfig("grove-anthropic");
    const body = await groveAnthropicMessage(llm, "Reply with exactly: pong");
    const block = body.content?.find((c) => c.type === "text");
    assert.ok(block?.text?.length > 0);
  });
});

groveDescribe("Grove agent dry-run (CH-ATL-003)", () => {
  let serverUp = false;

  before(async () => {
    try {
      const health = await fetch(`${BASE}/health`);
      serverUp = health.ok;
    } catch {
      serverUp = false;
    }
  });

  it("agent invokes MCP tools for hero chiller via grove-openai", async (t) => {
    if (!serverUp) {
      t.skip("MCP server not running — start with: npm run mcp:dev");
      return;
    }

    const llm = groveLlmConfig("grove-openai");
    const mcpClient = new McpHttpClient();
    await mcpClient.connect();

    const events = [];
    const result = await runAgent({
      mcpClient,
      llmConfig: llm,
      userMessage:
        "CH-ATL-003 has a motor temperature fault. What is the active alarm code? Use tools.",
      chillerId: "CH-ATL-003",
      onEvent: (event) => events.push(event),
    });

    const toolStarts = events.filter((e) => e.type === "tool_start").map((e) => e.tool);
    assert.ok(toolStarts.length > 0, "expected at least one tool call");
    assert.ok(
      toolStarts.some((name) =>
        ["getChillerById", "getActiveAlarms", "getSiteContext"].includes(name)
      ),
      `expected grounding tools, got: ${toolStarts.join(", ")}`
    );
    assert.ok(result.text.length > 0 || events.some((e) => e.type === "assistant_delta"));
  });
});
