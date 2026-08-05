# Build Plan — Virtual Engineer POV

## Phase A — Foundation
- [x] `backend/` scaffold with Express Streamable HTTP MCP
- [x] Shared MongoClient, env config
- [x] docs/architecture.md, docs/indexes.md

## Phase B — Deterministic tools
- [x] Asset tools: getChillerById, getChillerConfiguration, getSiteContext
- [x] Operational tools: alarms, telemetry, service history, parts, device state
- [x] getFaultEvents stub

## Phase C — Knowledge + case tools
- [x] knowledge_documents seed data
- [x] searchManuals, searchTroubleshootingGuides, searchTechnicalBulletins
- [x] filterCases, searchCaseNotes, rerank tools
- [x] Atlas autoEmbed query.text (regex fallback)

## Phase D — Session / feedback
- [x] startTroubleshootingSession, storeRecommendationTrace
- [x] captureEngineerReaction, captureResolutionOutcome

## Phase E — Handoff
- [x] docs/runbook.md, tests/connectivity
- [ ] Atlas search index provisioning (manual in Atlas UI)

## Phase F — Agent orchestration (Phase 2)
- [x] LLM agent with real MCP tool-use loop (OpenAI / Anthropic)
- [x] SSE chat API (`POST /api/chat`, `POST /api/feedback`)
- [x] `query_insight` metadata on all tool responses

## Phase G — Demo UI (Phase 3)
- [x] `frontend/` — Vite + React single-page app
- [x] Overview tab (informational first)
- [x] Evidence Board tab (Paradigm B — technical audience)
- [x] Field Chat tab with X-ray (Paradigm C — business audience)
- [x] Targeted data expansion (12 tickets, 12 knowledge docs, 13 alarm events)
