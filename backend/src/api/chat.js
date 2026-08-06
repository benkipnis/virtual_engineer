import { Router } from "express";
import { getLlmConfig } from "../config/env.js";
import { McpHttpClient } from "../agent/mcpClient.js";
import { runAgent } from "../agent/orchestrator.js";

const router = Router();

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.get("/health", (_req, res) => {
  try {
    const llm = getLlmConfig();
    res.json({
      status: "ok",
      service: "virtual-engineer-chat",
      llm: {
        provider: llm.provider,
        protocol: llm.protocol,
        gateway: llm.gateway,
        model: llm.model,
      },
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

router.post("/chat", async (req, res) => {
  const { message, chiller_id: chillerId } = req.body || {};

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  let llmConfig;
  try {
    llmConfig = { ...getLlmConfig(), maxSteps: Number(process.env.AGENT_MAX_STEPS || 12) };
  } catch (err) {
    res.status(503).json({ error: err.message });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const mcpClient = new McpHttpClient();

  try {
    await mcpClient.connect();

    await runAgent({
      mcpClient,
      llmConfig,
      userMessage: message,
      chillerId: chillerId || null,
      onEvent: (event) => {
        const { type, ...payload } = event;
        if (type === "tool_start" && payload.tool) {
          sseWrite(res, type, {
            ...payload,
            pattern: payload.pattern || null,
          });
        } else {
          sseWrite(res, type, payload);
        }
      },
    });
  } catch (err) {
    sseWrite(res, "error", { message: err.message });
  } finally {
    res.end();
  }
});

router.post("/feedback", async (req, res) => {
  const { session_id: sessionId, signal, notes } = req.body || {};
  if (!sessionId || !signal) {
    res.status(400).json({ error: "session_id and signal are required" });
    return;
  }

  const mcpClient = new McpHttpClient();
  try {
    await mcpClient.connect();
    const { result } = await mcpClient.callTool("captureEngineerReaction", {
      session_id: sessionId,
      signal,
      notes: notes || "",
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
