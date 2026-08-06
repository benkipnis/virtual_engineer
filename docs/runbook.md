# Runbook — Virtual Engineer MCP Server + Demo UI

## Prerequisites

- Node.js 18+
- Atlas cluster with seeded data (`npm run seed:drop`)
- `.env` configured from `.env.example`
- LLM API key for demo UI chat — one of:
  - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (direct vendor APIs), or
  - `MDB_GROVE_API_KEY` with `LLM_PROVIDER=grove-openai` / `grove-anthropic` (internal MongoDB Grove gateway)

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
| `LLM_PROVIDER` | `openai` | `openai`, `anthropic`, `grove-openai`, or `grove-anthropic` |
| `OPENAI_API_KEY` | — | Required when LLM_PROVIDER=openai |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `ANTHROPIC_API_KEY` | — | Required when LLM_PROVIDER=anthropic |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model |
| `MDB_GROVE_API_KEY` | — | Required when LLM_PROVIDER=grove-openai or grove-anthropic |
| `GROVE_BASE_URL` | `https://grove-gateway-prod.azure-api.net/grove-foundry-prod` | Grove gateway base URL |
| `GROVE_OPENAI_MODEL` | `gpt-4o` | Model ID for grove-openai |
| `GROVE_ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model ID for grove-anthropic |
| `AGENT_MAX_STEPS` | `12` | Max tool-use loop iterations |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `KNOWLEDGE_VECTOR_INDEX` | `knowledge_auto_embed_index` | Vector Search index on `knowledge_documents` |
| `KNOWLEDGE_SEARCH_INDEX` | `knowledge_search` | Atlas Search (lexical) index on `knowledge_documents`, used by `$rankFusion` |
| `TICKETS_VECTOR_INDEX` | `service_tickets_auto_embed_index` | Vector Search index on `service_tickets` |
| `TICKETS_SEARCH_INDEX` | `service_tickets_search` | Atlas Search (lexical) index on `service_tickets`, used by `$rankFusion` |

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

## LLM provider matrix

| `LLM_PROVIDER` | Protocol | Gateway | API key env | Suggested model |
|----------------|----------|---------|-------------|-----------------|
| `openai` | OpenAI | direct | `OPENAI_API_KEY` | `gpt-4o-mini` |
| `anthropic` | Anthropic | direct | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| `grove-openai` | OpenAI | Grove | `MDB_GROVE_API_KEY` | `gpt-4o` |
| `grove-anthropic` | Anthropic | Grove | `MDB_GROVE_API_KEY` | `claude-sonnet-4-6` |

**Grove prerequisites (internal MongoDB demos):**

- `MDB_GROVE_API_KEY` issued internally (not available to external customers)
- Network access to `grove-gateway-prod.azure-api.net` (may require VPN/corp network)
- Use Grove-specific model deployment names — invalid IDs fail at runtime

**Grove example `.env`:**

```bash
LLM_PROVIDER=grove-openai
MDB_GROVE_API_KEY=your-grove-key
GROVE_OPENAI_MODEL=gpt-4o
```

Verify config: `GET /api/health` returns `llm.provider`, `llm.gateway`, and `llm.model` (no secrets).

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
Knowledge and case-note search use native `$rankFusion` hybrid search (vector + lexical) — this requires
**four** indexes Active (vector + lexical for both `knowledge_documents` and `service_tickets`) and
MongoDB 8.0+ on the Atlas cluster. There is no regex fallback if indexes are unavailable.

Validate/provision from the CLI (M10+ clusters):

```bash
npm run indexes:check    # reports READY / BUILDING / MISSING for all four indexes
npm run indexes:create   # creates any missing indexes, then polls until READY
```

## Tests

```bash
# Terminal 1
npm run mcp:dev

# Terminal 2
npm run test:connectivity
cd frontend && npm run build
```
