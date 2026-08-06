# Test Plan — Virtual Engineer MCP + Demo UI

## Connectivity (`npm run test:connectivity`)

| Test | Command / check | Expected |
|------|-----------------|----------|
| Health | GET `/health` | `status: ok` |
| Tool list | MCP `tools/list` | includes getChillerById, searchManuals |
| Hero chiller | getChillerById CH-ATL-003 | 30XA, fault status |
| Hero alarm | getActiveAlarms CH-ATL-003 | A1.01 active |
| DAL scenario | getActiveAlarms CH-DAL-002 | 207 active |
| DAL history | getServiceHistory CH-DAL-002 | WO-2025-09432 |
| PHX scenario | getActiveAlarms CH-PHX-005 | Co.A1 active |
| PHX history | getServiceHistory CH-PHX-005 | WO-2025-03120 |
| Query insight | getChillerById response | `query_insight.pattern: exact_find` |
| Hybrid search (knowledge) | searchManuals response | `query_insight.pattern: hybrid_search`, excerpt includes `$rankFusion` |
| Hybrid search (cases) | searchCaseNotes response | `query_insight.pattern: hybrid_search`, excerpt includes `$rankFusion` |
| Chat API | GET `/api/health` | 200 or 503 (if no LLM key); when configured, includes `llm.gateway` |

## Frontend build

```bash
cd frontend && npm install && npm run build
```

## Demo UI dry-run scenarios

Run backend + frontend, then test each scenario via Overview starter prompts:

| Scenario | Chiller | Expected patterns surfaced |
|----------|---------|---------------------------|
| Hero motor temp | CH-ATL-003 | exact_find, aggregation_lookup, time_series_window, vector_search, hybrid_search |
| Condenser pressure | CH-DAL-002 | exact_find, time_series_window, hybrid_search |
| Communication fault | CH-PHX-005 | exact_find, vector_search, hybrid_search |
| Stable unit | CH-ATL-001 | exact_find only (no active alarms) |

## Manual hero scenario (MCP tools)

1. getSiteContext(CH-ATL-003) → Piedmont hospital site
2. getActiveAlarms → A1.01 with definition
3. getTelemetry(24h window) → rising motor_winding_temp_f
4. getServiceHistory → WO-2025-11847
5. searchTroubleshootingGuides("motor temperature PTC") → KB-30XA-A1.01-MOTOR
6. startTroubleshootingSession → store trace → capture reaction

## Search index dependency

`searchManuals`/`searchTroubleshootingGuides`/`searchTechnicalBulletins` and `searchCaseNotes` use native
`$rankFusion` hybrid search (vector + lexical), which requires **four** indexes to be Active:

| Collection | Vector index | Lexical (Atlas Search) index |
|------------|---------------|-------------------------------|
| `knowledge_documents` | `knowledge_auto_embed_index` | `knowledge_search` |
| `service_tickets` | `service_tickets_auto_embed_index` | `service_tickets_search` |

If any required index is missing or not Active, the tool returns `degraded: true` with empty results and
an error message — there is **no regex fallback**. `$rankFusion` also requires MongoDB 8.0+ on the Atlas
cluster (see `docs/indexes.md`).

## LLM dependency

Chat API requires one of:

| Mode | Env |
|------|-----|
| Direct OpenAI (default) | `OPENAI_API_KEY`, `LLM_PROVIDER=openai` |
| Direct Anthropic | `ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic` |
| Grove OpenAI | `MDB_GROVE_API_KEY`, `LLM_PROVIDER=grove-openai` |
| Grove Anthropic | `MDB_GROVE_API_KEY`, `LLM_PROVIDER=grove-anthropic` |

## LLM config unit tests

```bash
node --test tests/connectivity/llm-config.test.js
```

## Grove smoke test (optional)

Runs only when `MDB_GROVE_API_KEY` is set:

```bash
node --test tests/connectivity/grove-llm-smoke.test.js
```

Validates Grove gateway connectivity and a minimal agent tool-use loop for CH-ATL-003.
