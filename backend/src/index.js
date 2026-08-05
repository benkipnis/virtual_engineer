import { randomUUID } from "node:crypto";
import express from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { env } from "./config/env.js";
import { closeDb, pingDb } from "./db/client.js";
import { createMcpServer } from "./mcp/createServer.js";
import { ensureSessionIndexes } from "./repositories/sessions.js";
import chatRouter from "./api/chat.js";

const app = createMcpExpressApp({ host: env.mcpHost });

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", env.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

/** @type {Record<string, StreamableHTTPServerTransport>} */
const transports = {};

function checkAuth(req, res) {
  if (env.mcpAuthDisabled || !env.mcpApiKey) return true;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== env.mcpApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function jsonRpcError(res, status, code, message) {
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code, message },
    id: null,
  });
}

app.get("/health", async (_req, res) => {
  try {
    await pingDb();
    res.json({
      status: "ok",
      service: "virtual-engineer-mcp",
      tools: 24,
      chat: "/api/chat",
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

app.use("/api", chatRouter);

app.post("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const sessionId = req.headers["mcp-session-id"];

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      jsonRpcError(res, 400, -32000, "Bad Request: No valid session ID provided");
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send(err.message);
    }
  }
});

app.delete("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send(err.message);
    }
  }
});

const httpServer = app.listen(env.mcpPort, env.mcpHost, async () => {
  try {
    await pingDb();
    await ensureSessionIndexes();
    console.log(`Virtual Engineer server listening on http://${env.mcpHost}:${env.mcpPort}`);
    console.log(`  MCP endpoint: POST/GET/DELETE http://localhost:${env.mcpPort}/mcp`);
    console.log(`  Chat API:     POST http://localhost:${env.mcpPort}/api/chat`);
    console.log(`  Health:       GET  http://localhost:${env.mcpPort}/health`);
  } catch (err) {
    console.error("Startup warning:", err.message);
  }
});

async function shutdown() {
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch {
      // ignore close errors during shutdown
    }
  }
  httpServer.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
