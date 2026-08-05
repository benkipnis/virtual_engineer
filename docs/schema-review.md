# Schema Review — Virtual Engineer Sample Data

## Context

- **Use case:** Virtual Engineer Phase 1 deterministic operational retrieval (asset context, alarms, telemetry, service history)
- **Collections in scope:** `sites`, `chillers`, `alarm_definitions`, `alarm_events`, `telemetry`, `service_tickets`
- **Access patterns:**
  - Resolve chiller by `chiller_id` (primary entry point)
  - Lookup site by `site_id` via chiller reference
  - Active alarms: `{ chiller_id, status: "active" }`
  - Alarm history: `{ chiller_id }` sorted by `raised_at`
  - Alarm catalog: `{ alarm_code }`
  - Telemetry window: `{ chiller_id, timestamp: { $gte, $lte } }`
  - Service history: `{ chiller_id }` sorted by `opened_at`
- **Success criteria impacted:** Asset resolution, fault state retrieval, telemetry context, maintenance history for troubleshooting recommendations

## Proposed Schema

### Collection: `sites`

- **Key fields:** `site_id` (string, PK), `name`, `customer_name`, `address` (object), `timezone`, `building_type`, `service_contract` (object)
- **Embedded documents/arrays:** `address`, `service_contract`
- **Expected cardinalities:** 1 site per chiller in demo set (5 sites); production may be many chillers per site
- **Example document:** See `scripts/data/samples/sites.json`

### Collection: `chillers`

- **Key fields:** `chiller_id` (string, PK), `site_id` (FK), `serial_number`, `model_family`, `model_number`, `product_line`, `configuration` (object), `operating_status`, `install_date`, `firmware_version`, `connectivity` (object), `current_setpoints` (object)
- **Embedded documents/arrays:** `configuration`, `connectivity`, `current_setpoints`
- **Expected cardinalities:** 5 demo units; 1:1 with site in sample set
- **Example document:** See `scripts/data/samples/chillers.json`

### Collection: `alarm_definitions`

- **Key fields:** `alarm_code` (string, PK), `code_format`, `model_families` (array), `subsystem`, `severity`, `description`, `reason`, `control_action`, `reset_type`, `probable_causes` (array), `diagnostic_steps` (array)
- **Embedded documents/arrays:** `model_families`, `probable_causes`, `diagnostic_steps`
- **Expected cardinalities:** ~15–20 reference documents shared across all chillers; grows slowly as new codes are cataloged
- **Example document:** See `scripts/data/samples/alarm_definitions.json`

### Collection: `alarm_events`

- **Key fields:** `event_id` (string, PK), `chiller_id` (FK), `alarm_code` (FK), `status`, `raised_at`, `cleared_at`, `circuit`, `source`, `acknowledged`, `acknowledged_by`
- **Embedded documents/arrays:** None
- **Expected cardinalities:** Many events per chiller over time; demo set includes 8 events across 5 chillers
- **Example document:** See `scripts/data/samples/alarm_events.json`

### Collection: `telemetry`

- **Key fields:** `chiller_id` (meta/time-series), `timestamp` (timeField), `readings` (object with metric keys)
- **Embedded documents/arrays:** `readings` object per timestamp
- **Expected cardinalities:** 7 days × hourly × 5 chillers = 840 documents in `samples/telemetry.json`
- **Collection type:** MongoDB time series (`timeField: timestamp`, `metaField: chiller_id`, `granularity: minutes`)
- **Example document:** See `scripts/data/samples/telemetry.json`

### Collection: `service_tickets`

- **Key fields:** `ticket_id` (string, PK), `chiller_id` (FK), `site_id` (FK), `status`, `priority`, `type`, `opened_at`, `closed_at`, `reported_symptom`, `related_alarm_codes` (array), `technician` (object), `work_performed`, `parts_replaced` (array), `resolution`, `root_cause`
- **Embedded documents/arrays:** `technician`, `parts_replaced`, `related_alarm_codes`
- **Expected cardinalities:** Multiple tickets per chiller over equipment lifetime; 5 demo tickets
- **Example document:** See `scripts/data/samples/service_tickets.json`

## MongoDB Pattern Mapping

| Pattern | Application | Rationale |
|---------|-------------|-----------|
| **Extended Reference** | `chillers.site_id` → `sites` | Site context retrieved independently via `getSiteContext()` |
| **Reference** | `alarm_events.alarm_code` → `alarm_definitions` | Shared alarm catalog; avoids duplicating definitions on every event |
| **Bucket / Time Series** | `telemetry` collection | Time-window queries by chiller; readings grouped per timestamp |
| **Subset** | `chillers.configuration` | Stable equipment config subset for asset context |
| **Attribute** | `chillers.connectivity`, `current_setpoints` | Operational attributes that vary independently of master identity |

Not applicable for this scope: Computed, Document Versioning, Outlier, Polymorphic, Schema Versioning, Tree/Graph.

## Anti-Pattern Check

| Risk | Assessment |
|------|------------|
| **Unbounded arrays** | Avoided — telemetry and alarm history stored in dedicated collections, not embedded on `chillers` |
| **Excessive normalization** | `alarm_definitions` separated intentionally (reference catalog); site kept separate for independent lookup |
| **Large document (16 MB)** | Low risk — telemetry uses time series; `readings` object is bounded metric set per document |

## Index Recommendations

```javascript
// sites
db.sites.createIndex({ site_id: 1 }, { unique: true });

// chillers
db.chillers.createIndex({ chiller_id: 1 }, { unique: true });
db.chillers.createIndex({ site_id: 1 });
db.chillers.createIndex({ serial_number: 1 });

// alarm_definitions
db.alarm_definitions.createIndex({ alarm_code: 1 }, { unique: true });
db.alarm_definitions.createIndex({ model_families: 1, subsystem: 1 });

// alarm_events
db.alarm_events.createIndex({ chiller_id: 1, status: 1 });
db.alarm_events.createIndex({ chiller_id: 1, raised_at: -1 });
db.alarm_events.createIndex({ alarm_code: 1 });

// telemetry (time series — meta index automatic)
// Fallback if not time series:
db.telemetry.createIndex({ chiller_id: 1, timestamp: -1 });

// service_tickets
db.service_tickets.createIndex({ chiller_id: 1, opened_at: -1 });
db.service_tickets.createIndex({ status: 1 });
```

## Hero Troubleshooting Scenario

**Primary demo unit:** `CH-ATL-003` (30XA080, Piedmont Regional Medical Center)

| Layer | Data |
|-------|------|
| Asset | 30XA air-cooled, 80 tons, R-410A, 2 circuits |
| Active fault | `alarm_events` EVT-2026-0042 — `A1.01` active on circuit A |
| Alarm meaning | `alarm_definitions.A1.01` — Compressor motor temperature too high |
| Telemetry | Rising `motor_winding_temp_f` (168°F → 198°F) and `bearing_temp_f` over 24h before alarm |
| Prior service | Ticket WO-2025-11847 (closed) — same alarm, motor sensor PTC replaced 8 months ago |

## Open Decisions and Trade-Offs

- **Option A:** Separate `sites` collection (chosen)
- **Option B:** Embed site on `chillers`
- **Recommendation:** Option A — aligns with `getSiteContext()` as distinct lookup; supports future many-chillers-per-site without duplication

## Hard Gate Approval

- **Approval requested from:** User (pattern approved)
- **Approval response:** "pattern approved; let's build it."
- **Date:** 2026-07-17
- **Logged in `docs/gates.md`:** Yes
