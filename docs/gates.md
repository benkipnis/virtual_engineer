# Hard Gate Log

## Project

- **Project name:** Virtual Engineer POV — Sample Data
- **Customer/account:** _(generic POV — not customer-specific)_
- **Owner:** Ben Kipnis
- **Last updated:** 2026-08-05

## Gate Entries

| Gate ID | Gate Name | What was presented | Approval phrase (exact) | Approved by | Date | Evidence links |
|---|---|---|---|---|---|---|
| G1 | Data Model Review | Six-collection schema for sites, chillers, alarm_definitions, alarm_events, telemetry, service_tickets with MongoDB pattern mapping | pattern approved; let's build it. | User | 2026-07-17 | docs/schema-review.md, scripts/data/schemas/ |
| G1b | Sample Data Review | Seeded to Atlas | implicit approval via build | User | 2026-07-17 | scripts/data/samples/ |
| G2 | Architecture & Technology Selection | MCP HTTP server + Atlas autoEmbed search | build it | User | 2026-07-17 | docs/architecture.md |
| G3 | Build Plan | Phases A–E MCP implementation | build it | User | 2026-07-17 | docs/build-plan.md |
| G4 | Agent + Chat API | LLM agent on MCP, SSE chat, query_insight metadata | implement plan | User | 2026-08-05 | backend/src/agent/, backend/src/api/chat.js |
| G5 | Demo UI | Evidence Board + Field Chat dual paradigms | implement plan | User | 2026-08-05 | frontend/ |

## Notes

- G1b (sample data review) pending after sample documents are presented.
- Alarm definitions are reference data; alarm instances live in `alarm_events`.
- Telemetry collection should be created as MongoDB time series when loading to Atlas.
