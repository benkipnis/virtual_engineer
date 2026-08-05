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
| Chat API | GET `/api/health` | 200 or 503 (if no LLM key) |

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

Semantic search tools return `degraded: true` until Atlas autoEmbed indexes are Active.

## LLM dependency

Chat API requires `OPENAI_API_KEY` (default) or `ANTHROPIC_API_KEY` with `LLM_PROVIDER=anthropic`.
