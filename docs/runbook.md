# Runbook — Virtual Engineer MCP Server + Demo UI

## Prerequisites

- Node.js 18+
- Atlas cluster with seeded data (`npm run seed:drop`)
- `.env` configured from `.env.example`
- LLM API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) for demo UI chat

## Start the server

```bash
npm install
npm run mcp:dev
```

Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | DB ping + service status |
| POST | `/mcp` | MCP JSON-RPC (initialize, tools/call) |
| GET | `/mcp` | SSE stream for server messages (requires `mcp-session-id` header) |
| DELETE | `/mcp` | Session termination |
| POST | `/api/chat` | LLM agent chat (SSE stream) |
| POST | `/api/feedback` | Engineer reaction capture |
| GET | `/api/health` | Chat API health (checks LLM key) |

Default: `http://localhost:3100`

## Start the demo UI

```bash
# Terminal 1 — backend
npm run mcp:dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to the backend.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | — | Atlas connection string |
| `MONGODB_DB` | `virtual_engineer` | Database name |
| `MCP_PORT` | `3100` | HTTP port |
| `MCP_HOST` | `0.0.0.0` | Bind address |
| `MCP_API_KEY` | — | Bearer token when auth enabled |
| `MCP_AUTH_DISABLED` | `false` | Set `true` for local dev |
| `MCP_BASE_URL` | `http://localhost:3100` | MCP URL for agent client |
| `LLM_PROVIDER` | `openai` | `openai` or `anthropic` |
| `OPENAI_API_KEY` | — | Required when LLM_PROVIDER=openai |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `ANTHROPIC_API_KEY` | — | Required when LLM_PROVIDER=anthropic |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model |
| `AGENT_MAX_STEPS` | `12` | Max tool-use loop iterations |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |

## Cursor MCP configuration

```json
{
  "mcpServers": {
    "virtual-engineer": {
      "url": "http://localhost:3100/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

If `MCP_AUTH_DISABLED=true`, omit the Authorization header.

## Demo scenarios

See scenario matrix in `scripts/data/README.md`. Four demo-ready paths:

1. **CH-ATL-003** — Hero motor temperature fault (A1.01)
2. **CH-DAL-002** — High condenser pressure (207)
3. **CH-PHX-005** — Communication fault (Co.A1)
4. **CH-ATL-001** — Stable unit (negative control)

Use the Overview tab starter prompts, then switch between Evidence Board (technical) and Field Chat (business + X-ray).

## Reseed data

```bash
npm run seed:drop
```

## Search indexes

Create Atlas indexes per [docs/indexes.md](indexes.md) before expecting semantic search without `degraded: true`.

## Tests

```bash
# Terminal 1
npm run mcp:dev

# Terminal 2
npm run test:connectivity
cd frontend && npm run build
```
