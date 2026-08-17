# Virtual Engineer — Sample Data

Sample schema and inter-related demo documents for the Virtual Engineer Phase 1 deterministic data layer.

## Collections

| Collection | Purpose | Sample count |
|------------|---------|--------------|
| `sites` | Installation context (`getSiteContext`) | 5 |
| `chillers` | Asset master records (`getChillerById`) | 5 |
| `alarm_definitions` | Alarm reference catalog (`getAlarmDetails`) | 18 |
| `alarm_events` | Per-chiller alarm instances (`getActiveAlarms`, `getAlarmHistory`) | 13 |
| `telemetry` | Time-series readings (`getTelemetry`) | 840 (7 days × hourly × 5 chillers) |
| `service_tickets` | Work order history (`getServiceHistory`) | 12 |
| `knowledge_documents` | Manuals, guides, bulletins (`searchManuals`, etc.) | 12 |

## Demo Scenario Matrix

| Chiller | Model | Active alarm | Scenario | Prior closed cases |
|---------|-------|--------------|----------|-------------------|
| **CH-ATL-003** | 30XA080 | `A1.01` | Hero — repeat motor temp fault; prior PTC sensor replacement | WO-2025-11847 |
| **CH-DAL-002** | 19XR500 | `207` | High condenser pressure; cooling tower fan VFD fault | WO-2025-09432, WO-2024-06781 |
| **CH-PHX-005** | 30RB400 | `Co.A1` | Compressor board communication loss; LEN bus fault | WO-2025-03120, WO-2024-11205 |
| **CH-ATL-001** | 30RB250 | _(none)_ | Stable unit — PM history only (negative control) | WO-2026-02104 |
| **CH-CHI-004** | 30XA120 | _(none)_ | Cross-case: prior A1.01 resolved via coil cleaning (not PTC) | WO-2025-07654 |

## Hero Troubleshooting Scenario

Use **`CH-ATL-003`** (30XA080 at Piedmont Regional Medical Center) to demo the full fact chain:

- **Active alarm:** `A1.01` — Compressor A1 Motor Temperature Too High (circuit A)
- **Telemetry:** Rising `motor_winding_temp_f` (168°F → 201°F) over 24h before trip
- **Prior service:** `WO-2025-11847` — same alarm 8 months ago, PTC sensor replaced
- **Open ticket:** `WO-2026-04291` — emergency dispatch in progress

## Directory Layout

```
scripts/data/
├── generate-telemetry.js   # Configurable 7-day hourly telemetry generator
├── schemas/              # JSON Schema definitions
├── samples/              # Sample documents (JSON arrays)
└── seed/
    └── load-sample-data.js
```

## Telemetry

`telemetry` is a **MongoDB time series** collection (`timeField: timestamp`, `metaField: chiller_id`, `granularity: minutes`).

Sample data covers **7 days of hourly readings** (168 points per chiller, 840 total). The window **ends at the current hour** by default — run the generator at any time and you get a fresh window anchored to now.

Regenerate telemetry (reproducible, seed `42`):

```bash
node scripts/data/generate-telemetry.js
```

Options: `--days 7`, `--interval-hours 1`, `--seed 42`, `--output <path>`, `--end-time <ISO8601>`

Per-chiller behavior (positioned relative to window end, not to absolute dates):

- **CH-ATL-003** — normal operation, then rising motor temps in the 30 h before `A1.01` trip (~2 h 38 m before window end)
- **CH-DAL-002** — rising condenser pressure before `207` trip (~18 h 52 m before window end)
- **CH-PHX-005** — running until `Co.A1` fault (~4 h 55 m before window end), then offline readings
- **CH-ATL-001**, **CH-CHI-004** — stable operation with diurnal load variation

## Keeping data fresh

The agent queries alarm history and telemetry using `Date.now()`-relative windows. Running `npm run seed:drop` resets everything to a fresh baseline anchored to the current time.

For **continuous automated freshness** without any manual steps, deploy the Atlas Scheduled Trigger:

```
scripts/data/atlas-trigger/refresh-demo-data.js
```

The trigger fires daily at 02:00 UTC and:
- Rolls `raised_at` on active alarms forward by one day
- Rolls `opened_at` on open / in-progress tickets forward by one day
- Drops and regenerates the telemetry collection with a 7-day window ending at the current hour

See **`docs/data-freshness.md`** for full setup instructions.

## Load into MongoDB Atlas

Prerequisites:

- Node.js 18+
- Dependencies installed: `npm install`
- `.env` file at repo root (copy from `.env.example`)

```bash
# From repo root
cp .env.example .env   # then edit .env with your Atlas URI

npm install
npm run seed:drop      # replace all sample data
# or
npm run seed           # insert only if collections are empty
```

The seed script:

1. Regenerates telemetry (7-day hourly) unless `--no-regenerate-telemetry` is passed
2. Creates the `telemetry` collection as a **time series** collection (or uses existing)
3. Inserts all sample documents from `samples/*.json`
4. Creates recommended indexes

Use `--drop` to clear collections before insert (destructive):

```bash
MONGODB_URI="..." node scripts/data/seed/load-sample-data.js --drop
```

Skip telemetry regeneration and load the committed `samples/telemetry.json` as-is:

```bash
MONGODB_URI="..." node scripts/data/seed/load-sample-data.js --no-regenerate-telemetry
```

## Cross-Reference Integrity

All foreign keys resolve:

- Every `chillers.site_id` → `sites.site_id`
- Every `alarm_events.chiller_id` → `chillers.chiller_id`
- Every `alarm_events.alarm_code` → `alarm_definitions.alarm_code`
- Every `service_tickets.chiller_id` / `site_id` → matching records
- Every `telemetry.chiller_id` → `chillers.chiller_id`

## Gates

- **G1 (schema):** Approved 2026-07-17 — see `docs/schema-review.md`
- **G1b (samples):** Approved 2026-07-17
- **G2/G3 (MCP):** Approved — see `docs/architecture.md`, `docs/runbook.md`

## MCP Server

After seeding, start the Virtual Engineer MCP server:

```bash
npm run mcp:dev          # http://localhost:3100
npm run test:connectivity
```

See `docs/runbook.md` for Cursor MCP configuration and hero demo sequence.

## Source Attribution

Alarm codes and descriptions are aligned with publicly available OEM chiller service manuals (30XA AquaForce, 30RB AquaSnap, 19XR Evergreen). Telemetry metric names follow EquipPulse remote monitoring and NetCtrl control network conventions.
