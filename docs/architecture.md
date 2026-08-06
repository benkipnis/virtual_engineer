# Architecture — Virtual Engineer MCP

## Scope

- **Use case:** Agentic troubleshooting for commercial chiller field engineers
- **Workload:** Read-heavy deterministic lookups + hybrid semantic search + session writes
- **Demo audience:** Solutions Architects, technical stakeholders

## Component Map

| Component | Atlas service/product | Responsibility |
|-----------|----------------------|----------------|
| Operational data | Atlas Database | chillers, sites, alarms, telemetry, service_tickets |
| Knowledge retrieval | Atlas Vector Search (autoEmbed) + Atlas Search via `$rankFusion` | searchManuals, searchTroubleshootingGuides, searchTechnicalBulletins |
| Case advisory | Atlas Vector Search (autoEmbed) + Atlas Search via `$rankFusion` | searchCaseNotes, filterCases |
| Session/feedback | Atlas Database | troubleshooting_sessions, recommendation_traces, engineer_feedback |
| MCP server | Node.js + `@modelcontextprotocol/sdk` + Express | HTTP MCP transport, 24 tools |
| LLM agent | OpenAI, Anthropic, or MongoDB Grove gateway | Tool-use orchestration via MCP HTTP client |
| Demo UI | Vite + React | Evidence Board + Field Chat paradigms, SSE chat consumer |

## Non-MongoDB Dependencies

| Dependency | Why needed | Atlas alternative | Decision |
|------------|------------|-------------------|----------|
| `@modelcontextprotocol/sdk` | MCP protocol | None | Required |
| `express` | Streamable HTTP host | None | SDK `createMcpExpressApp` |
| `zod` | Tool input validation | None | Required by MCP SDK |
| OpenAI / Anthropic API | LLM agent reasoning (direct) | None | Required for external demos |
| MongoDB Grove gateway | LLM agent reasoning (internal) | None | Optional; single `MDB_GROVE_API_KEY` proxies to vendor APIs |
| Vite + React | Demo UI | None | Required for Phase 3 UI |

## Diagram

See plan: Streamable HTTP MCP → repository layer → Atlas collections and search indexes.

## Trade-Offs

- **Latency:** Stateless MCP per-request server instance — simple for POV; production may use session pooling
- **Search:** Atlas Automated Embedding removes embedding pipeline; depends on Atlas Public Preview availability
- **Hybrid search:** `$rankFusion` (Reciprocal Rank Fusion) combines vector + lexical results natively — requires MongoDB 8.0+ on the Atlas cluster (8.0.x needs a support case to enable; native on 8.1+). It is a Preview feature. No application-level score merging or regex fallback is used; if the required indexes are unavailable, tools return `degraded: true` with empty results.
- **Auth:** API key bearer token; disabled in local dev via `MCP_AUTH_DISABLED=true`

## Hard Gate Approval

- **Approval:** User — "build it" (2026-07-17)
- **Logged in `docs/gates.md`:** Yes (G2/G3)
