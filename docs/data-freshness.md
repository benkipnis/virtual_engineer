# Data Freshness — Virtual Engineer Demo

This document covers how the demo data is kept temporally current so that dates always look recent regardless of when the demo runs.

## Problem

The demo narrative depends on timestamps feeling "live":
- Active alarms should have been raised hours or days ago — not months ago.
- The telemetry window (`getAlarmHistory`, `getTelemetry`) uses date-range queries against `Date.now()`, so stale timestamps produce empty results and break the agent's fact chain.
- Historical closed tickets and cleared alarms are **intentionally in the past** and do not need updating.

## What stays fresh vs. what is static

| Collection / records | Needs freshening? | Mechanism |
|---|---|---|
| `telemetry` (all 840 docs) | **Yes** | Full regeneration anchored to `Date.now()` |
| `alarm_events` where `status: "active"` | **Yes** | `$dateAdd` on `raised_at` |
| `service_tickets` where `status: "open"` or `"in_progress"` | **Yes** | `$dateAdd` on `opened_at` |
| `alarm_events` (cleared / historical) | No — intentional past dates | Untouched |
| `service_tickets` (closed) | No — historical records | Untouched |
| `sites`, `chillers`, `alarm_definitions`, `knowledge_documents` | No — static reference data | Untouched |

## How it works

### Telemetry generator (local seeding)

`scripts/data/generate-telemetry.js` now defaults `endTime` to the current hour rather than a hardcoded date. Every time `npm run seed:drop` is run the 7-day telemetry window ends at "now."

Alarm trip times are stored as **millisecond offsets before window end** (`ALARM_OFFSETS_MS`) so the narrative shape (rising temps → alarm trip → lockout) is always positioned correctly relative to the current time:

| Chiller | Scenario | Trip offset from window end |
|---|---|---|
| CH-ATL-003 | Motor temp hero fault | ~2 h 38 m |
| CH-DAL-002 | Condenser pressure trip | ~18 h 52 m |
| CH-PHX-005 | Communication loss / offline | ~4 h 55 m |

### Atlas Scheduled Trigger (ongoing automated refresh)

`scripts/data/atlas-trigger/refresh-demo-data.js` is an Atlas App Services Function that runs on a cron schedule. It:

1. Reads a `demo_settings.refresh_state` document to determine how many days have elapsed since the last run (capped at 7 to handle gaps gracefully).
2. Advances `raised_at` on all `active` alarm events by that many days.
3. Advances `opened_at` on all `open` / `in_progress` service tickets by the same amount.
4. Drops and recreates the `telemetry` time-series collection with a fresh 7-day window ending at the current hour.
5. Writes back the `last_refreshed_at` timestamp to `demo_settings`.

The telemetry math (Mulberry32 PRNG, chiller behavior curves, alarm stress signatures) is identical to the local generator so the narrative shape is preserved.

---

## Deploying the Atlas Trigger

### Prerequisites

- Atlas cluster M10+ (App Services is not available on Serverless or shared tiers)
- App Services application already linked to the cluster (any existing application works; create one at **Atlas → App Services → Create Application** if needed)

### Step 1 — Create the function

1. In the Atlas UI, open your App Services application.
2. Go to **Functions** → **Create New Function**.
3. Name it exactly `refreshDemoData`.
4. Set **Authentication** to `System`.
5. Paste the full contents of `scripts/data/atlas-trigger/refresh-demo-data.js` into the function editor.
6. Update the two configuration constants at the top of the file if needed:

```js
const SERVICE_NAME = "mongodb-atlas"; // name of your linked data source
const DB_NAME = "virtual_engineer";   // your database name
```

7. Click **Save Draft** then **Review & Deploy**.

### Step 2 — Create the scheduled trigger

1. Go to **Triggers** → **Add Trigger**.
2. Set **Trigger Type** to `Scheduled`.
3. Name it `refreshDemoDataDaily`.
4. Set the schedule using **Advanced (CRON expression)**:

```
0 2 * * *
```

This fires at **02:00 UTC every day**, outside typical demo hours in any US timezone.

5. Under **Function**, select `refreshDemoData`.
6. Click **Save**.

### Step 3 — Verify

After saving, click **Run** on the trigger to execute it immediately. Check the **Logs** tab in App Services for output like:

```json
{
  "refreshed_at": "2026-08-18T02:00:00.000Z",
  "days_drift": 1,
  "alarms_rolled": 3,
  "tickets_rolled": 2,
  "telemetry_points": 840,
  "telemetry_window": {
    "start": "2026-08-11T02:00:00.000Z",
    "end": "2026-08-18T02:00:00.000Z"
  }
}
```

> **Note on `demo_settings` collection**: The trigger automatically creates a `demo_settings` document (`_id: "refresh_state"`) on first run. No manual setup required.

---

## Manual refresh

Run a full re-seed from your local machine at any time:

```bash
npm run seed:drop
```

This drops all collections and re-seeds with telemetry anchored to `Date.now()`. Use this after any long gap (vacation, event preparation) to guarantee a clean baseline before a trigger run.

To regenerate only the telemetry file (without touching MongoDB):

```bash
node scripts/data/generate-telemetry.js
```

---

## Drift tracking and gap handling

The `demo_settings.refresh_state` document tracks `last_refreshed_at`. If the trigger is paused or misses days, the next run computes `daysDrift = Math.min(7, daysSinceLast)` so it catches up without over-advancing the timestamps beyond the telemetry window.

If the cluster is offline for more than 7 days, run `npm run seed:drop` to reset from a clean baseline.

---

## Alternatives considered

| Option | Verdict |
|---|---|
| **Atlas Trigger (chosen)** | Zero infrastructure, fully managed, no secrets in GitHub |
| GitHub Actions cron | Version-controlled but requires `MONGODB_URI` secret and causes brief downtime on full reseed |
| Demo offset in MCP layer | Elegant but requires changes to every repository function and complicates direct MongoDB queries |
| TTL + continuous telemetry injection | Best for persistent live installations; higher complexity for a periodic-use demo |
