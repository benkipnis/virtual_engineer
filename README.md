# Virtual Engineer

AI-assisted chiller troubleshooting demo powered by MongoDB Atlas. A field engineer describes a symptom; an LLM agent retrieves operational facts and knowledge through MCP tools, with live visibility into MongoDB retrieval patterns in the demo UI.

## What it demonstrates

- **Deterministic grounding** — asset resolution, alarms, telemetry, service history
- **Probabilistic retrieval** — Atlas Vector Search and hybrid case search
- **Real-time transparency** — query patterns, pipelines, and latency in the UI
- **Two demo paradigms** — Evidence Board (technical) and Field Chat with X-ray (business)

## Architecture

```
Demo UI (React)  →  LLM Agent (SSE)  →  MCP Server  →  Atlas
                                              ├── Database (operational data)
                                              ├── Vector Search (knowledge, cases)
                                              └── Atlas Search (case notes)
```

See [docs/architecture.md](docs/architecture.md) for details.

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster
- OpenAI or Anthropic API key (for chat)

## Quick start

```bash
cp .env.example .env   # add MONGODB_URI, OPENAI_API_KEY

npm install
npm run seed:drop      # load sample data into virtual_engineer database

# Terminal 1 — backend (MCP + chat API)
npm run mcp:dev

# Terminal 2 — demo UI
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Demo scenarios

| Chiller | Alarm | Story |
|---------|-------|-------|
| CH-ATL-003 | A1.01 | Hero — repeat motor temperature fault |
| CH-DAL-002 | 207 | High condenser pressure / cooling tower |
| CH-PHX-005 | Co.A1 | Compressor board communication loss |
| CH-ATL-001 | — | Stable unit (negative control) |

Starter prompts are on the Overview tab. See [scripts/data/README.md](scripts/data/README.md) for the full scenario matrix.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run mcp:dev` | Start MCP server + chat API (`:3100`) |
| `npm run seed:drop` | Reseed Atlas with sample data |
| `npm run test:connectivity` | Smoke tests (server must be running) |
| `cd frontend && npm run dev` | Demo UI dev server (`:5173`) |

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/runbook.md](docs/runbook.md) | Operations, env vars, troubleshooting |
| [docs/test-plan.md](docs/test-plan.md) | Test commands and dry-run scenarios |
| [docs/indexes.md](docs/indexes.md) | Atlas Search / Vector Search index definitions |
| [docs/phase-status.md](docs/phase-status.md) | Build phase tracker |

## License

[MIT](LICENSE)

## Requirements

Product and design rationale: [Virtual Engineer High-Level Requirements and Design Logic.md](Virtual%20Engineer%20High-Level%20Requirements%20and%20Design%20Logic.md)
