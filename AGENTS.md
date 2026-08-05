# Agent Instructions — Virtual Engineer

This repository is a **runnable Virtual Engineer demo**: MCP retrieval server, LLM agent, React UI, and Atlas sample data. It is not a generic toolkit.

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/src/` | Express server — MCP tools, LLM agent, SSE chat API |
| `backend/src/mcp/createServer.js` | 24 MCP tool definitions |
| `backend/src/agent/` | LLM orchestrator + MCP HTTP client |
| `backend/src/repositories/` | MongoDB data access layer |
| `frontend/src/` | Demo UI — Overview, Evidence Board, Field Chat |
| `scripts/data/` | Sample data, schemas, seed scripts |
| `tests/connectivity/` | MCP smoke tests |
| `docs/` | Architecture, runbook, gates, phase status |

## Local Cursor configuration

`.cursor/` (rules and skills) is **gitignored** and kept locally for agent-assisted development. It is not part of the published repository.

## Key workflows

### Run and test

```bash
npm run mcp:dev                    # backend on :3100
npm run test:connectivity          # requires server running
cd frontend && npm run dev         # UI on :5173
```

### Data changes

Edit `scripts/data/samples/`, then `npm run seed:drop`. See `scripts/data/README.md`.

### Add or change MCP tools

1. Implement repository function in `backend/src/repositories/`
2. Register tool in `backend/src/mcp/createServer.js` with `query_insight` metadata
3. Extend smoke tests in `tests/connectivity/`

### UI changes

Follow single-page multi-tab layout in `frontend/src/`. Both demo tabs share `ChatContext` SSE events.

## Design principles

1. **Deterministic first** — resolve asset and operational facts before knowledge/case search
2. **Real LLM agent** — no scripted tool sequences in demo paths
3. **Transparency** — surface `query_insight` (pattern, collection, pipeline) in the UI
4. **No customer branding** — use generic OEM terminology in sample data and docs

## Compliance artifacts

Maintain `docs/gates.md` and `docs/phase-status.md` when closing build phases.
