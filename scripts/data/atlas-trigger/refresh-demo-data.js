/**
 * Atlas App Services — Scheduled Trigger Function
 * Name:     refreshDemoData
 * Schedule: every day at 02:00 UTC  (CRON: 0 2 * * *)
 *
 * Keeps the Virtual Engineer demo data temporally current by:
 *   1. Rolling active alarm raised_at dates forward by the number of days
 *      elapsed since the last successful refresh.
 *   2. Rolling open / in-progress service ticket opened_at dates forward
 *      by the same amount.
 *   3. Dropping and regenerating the telemetry time-series collection so
 *      the 7-day window always ends at the current hour.
 *
 * Only records that are part of the live demo narrative are mutated.
 * Closed / cleared historical records remain untouched so the fact chain
 * (prior work orders, resolved alarms) stays coherent.
 *
 * Configuration — update these constants before deploying:
 *   SERVICE_NAME  Name of the Atlas linked data source in App Services
 *                 (default "mongodb-atlas")
 *   DB_NAME       Target database (default "virtual_engineer")
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SERVICE_NAME = "mongodb-atlas";
const DB_NAME = "virtual_engineer";

// Alarm trip times expressed as milliseconds BEFORE the telemetry window end.
// Must match the values in scripts/data/generate-telemetry.js ALARM_OFFSETS_MS.
const ALARM_OFFSETS_MS = {
  "CH-ATL-003": { code: "A1.01",  msBeforeEnd:  9_462_000 },
  "CH-DAL-002": { code: "207",    msBeforeEnd: 67_920_000 },
  "CH-PHX-005": { code: "Co.A1", msBeforeEnd: 17_700_000 },
};

// Telemetry generation parameters — keep in sync with generate-telemetry.js defaults.
const TELEMETRY_DAYS = 7;
const TELEMETRY_INTERVAL_HOURS = 1;
const TELEMETRY_SEED = 42;

// ---------------------------------------------------------------------------
// Entry point (Atlas App Services scheduled trigger)
// ---------------------------------------------------------------------------
exports = async function () {
  const client = context.services.get(SERVICE_NAME);
  const db = client.db(DB_NAME);

  const now = new Date();
  const log = [];

  // ── 1. Determine how many days to advance ─────────────────────────────────
  const settingsColl = db.collection("demo_settings");
  const state = await settingsColl.findOne({ _id: "refresh_state" });
  const lastRefreshed = state ? state.last_refreshed_at : null;

  // Cap drift at 7 days so a long outage doesn't over-advance the narrative.
  const daysDrift = lastRefreshed
    ? Math.min(7, Math.max(1, Math.round((now - lastRefreshed) / 86_400_000)))
    : 1;

  log.push(`days_drift: ${daysDrift}`);

  // ── 2. Roll active alarm raised_at forward ────────────────────────────────
  const alarmResult = await db.collection("alarm_events").updateMany(
    { status: "active" },
    [
      {
        $set: {
          raised_at: {
            $dateAdd: { startDate: "$raised_at", unit: "day", amount: daysDrift },
          },
        },
      },
    ]
  );
  log.push(`alarm_events updated: ${alarmResult.modifiedCount}`);

  // ── 3. Roll open / in-progress ticket opened_at forward ───────────────────
  const ticketResult = await db.collection("service_tickets").updateMany(
    { status: { $in: ["open", "in_progress"] } },
    [
      {
        $set: {
          opened_at: {
            $dateAdd: { startDate: "$opened_at", unit: "day", amount: daysDrift },
          },
        },
      },
    ]
  );
  log.push(`service_tickets updated: ${ticketResult.modifiedCount}`);

  // ── 4. Regenerate telemetry ───────────────────────────────────────────────
  // Time-series collections do not support in-place timestamp updates, so we
  // drop and recreate the collection with a fresh 7-day window ending now.

  const endTime = truncateToHour(now.getTime());
  const chillers = await db.collection("chillers").find({}).toArray();
  const telemetryDocs = buildTelemetry(chillers, endTime);

  // Drop existing time-series collection (ignore error if it doesn't exist).
  try {
    await db.runCommand({ drop: "telemetry" });
  } catch (_) {
    // Collection may not exist on first run.
  }

  // Recreate as a time-series collection.
  await db.runCommand({
    create: "telemetry",
    timeseries: {
      timeField: "timestamp",
      metaField: "chiller_id",
      granularity: "minutes",
    },
  });

  // Insert in batches of 500 to stay well within memory limits.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < telemetryDocs.length; i += BATCH) {
    const result = await db
      .collection("telemetry")
      .insertMany(telemetryDocs.slice(i, i + BATCH));
    inserted += result.insertedCount;
  }
  log.push(`telemetry_points inserted: ${inserted}`);

  // ── 5. Persist refresh state ──────────────────────────────────────────────
  await settingsColl.updateOne(
    { _id: "refresh_state" },
    { $set: { last_refreshed_at: now, days_drift_applied: daysDrift } },
    { upsert: true }
  );

  const summary = {
    refreshed_at: now.toISOString(),
    days_drift: daysDrift,
    alarms_rolled: alarmResult.modifiedCount,
    tickets_rolled: ticketResult.modifiedCount,
    telemetry_points: inserted,
    telemetry_window: {
      start: new Date(endTime - (TELEMETRY_DAYS * 24 - 1) * 3_600_000).toISOString(),
      end: new Date(endTime).toISOString(),
    },
  };

  console.log("refreshDemoData:", JSON.stringify(summary));
  return summary;
};

// ---------------------------------------------------------------------------
// Telemetry generation — pure math, no I/O
// Mirrors the logic in scripts/data/generate-telemetry.js exactly.
// ---------------------------------------------------------------------------

function truncateToHour(ms) {
  return ms - (ms % 3_600_000);
}

/**
 * Mulberry32 seeded PRNG — deterministic, reproducible sequences.
 * Same seed → same telemetry shape every time, just shifted in time.
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function diurnal(hourUtc, amplitude) {
  return Math.sin(((hourUtc - 14) / 24) * Math.PI * 2) * amplitude;
}

function baseProfile(chiller) {
  const sp = chiller.current_setpoints.leaving_chilled_water_f;
  const waterCooled = chiller.configuration.condenser_type === "water_cooled";
  const runHoursBase =
    {
      "CH-ATL-001": 31200,
      "CH-DAL-002": 52880,
      "CH-ATL-003": 42150,
      "CH-CHI-004": 28440,
      "CH-PHX-005": 18200,
    }[chiller.chiller_id] ?? 20000;

  const startsBase =
    {
      "CH-ATL-001": 2100,
      "CH-DAL-002": 890,
      "CH-ATL-003": 1840,
      "CH-CHI-004": 1565,
      "CH-PHX-005": 985,
    }[chiller.chiller_id] ?? 1000;

  return {
    sp,
    waterCooled,
    runHoursBase,
    startsBase,
    loadMid: waterCooled ? 0.88 : 0.72,
    loadAmp: waterCooled ? 0.08 : 0.12,
  };
}

function normalReadings(chiller, ts, rand, profile, startTime) {
  const hour = new Date(ts).getUTCHours();
  const dayOffset = (ts - startTime) / 3_600_000;

  const load =
    profile.loadMid +
    profile.loadAmp * diurnal(hour, 1) +
    (rand() - 0.5) * 0.06;
  const pctCapacity = round1(Math.min(98, Math.max(35, load * 100)));
  const pctCurrent = round1(pctCapacity * (0.9 + rand() * 0.08));

  const lwt = round1(profile.sp + (rand() - 0.5) * 1.2);
  const ewt = round1(lwt + 10 + load * 4 + (rand() - 0.5) * 1.5);
  const sct = round1(88 + diurnal(hour, 6) + load * 12 + (rand() - 0.5) * 2);
  const sst = round1(36 + load * 3 + (rand() - 0.5) * 1.2);
  const dischargeTemp = round1(128 + load * 18 + (rand() - 0.5) * 4);
  const bearingTemp = round1(108 + load * 12 + (rand() - 0.5) * 3);
  const motorWinding = round1(148 + load * 14 + (rand() - 0.5) * 4);
  const dischargePsi = round1(profile.waterCooled ? 135 + load * 12 : 275 + load * 25);
  const suctionPsi = round1(profile.waterCooled ? 46 + load * 4 : 68 + load * 6);

  const readings = {
    leaving_chilled_water_f: lwt,
    entering_chilled_water_f: ewt,
    saturated_condensing_temp_f: sct,
    saturated_suction_temp_f: sst,
    discharge_temp_f: dischargeTemp,
    bearing_temp_f: bearingTemp,
    motor_winding_temp_f: motorWinding,
    discharge_pressure_psig: dischargePsi,
    suction_pressure_psig: suctionPsi,
    percent_line_current: pctCurrent,
    line_voltage_v: round1(478 + (rand() - 0.5) * 4),
    percent_capacity: pctCapacity,
    unit_run_status: 1,
    compressor_starts: profile.startsBase + Math.floor(dayOffset / 48),
    run_hours: round1(profile.runHoursBase + dayOffset),
  };

  if (profile.waterCooled) {
    readings.leaving_condenser_water_f = round1(92 + diurnal(hour, 3) + load * 4);
  }

  return readings;
}

function heroDegradingReadings(chiller, ts, rand, profile, alarmAt, startTime) {
  const hoursToAlarm = (alarmAt - ts) / 3_600_000;

  if (hoursToAlarm <= 0) {
    return {
      leaving_chilled_water_f: round1(profile.sp + 6 + rand() * 2),
      entering_chilled_water_f: round1(profile.sp + 14),
      saturated_condensing_temp_f: round1(105 + rand() * 2),
      saturated_suction_temp_f: round1(40 + rand()),
      discharge_temp_f: 0,
      bearing_temp_f: round1(118 + rand() * 8),
      motor_winding_temp_f: round1(125 + rand() * 10),
      discharge_pressure_psig: round1(180 + rand() * 20),
      suction_pressure_psig: round1(55 + rand() * 5),
      percent_line_current: 0,
      line_voltage_v: round1(476 + rand() * 2),
      percent_capacity: 0,
      unit_run_status: hoursToAlarm > -2 ? 2 : 0,
      compressor_starts: profile.startsBase + 3,
      run_hours: round1(profile.runHoursBase + (ts - startTime) / 3_600_000),
    };
  }

  const readings = normalReadings(chiller, ts, rand, profile, startTime);

  if (hoursToAlarm < 30) {
    const stress = 1 - hoursToAlarm / 30;
    readings.motor_winding_temp_f = round1(155 + stress * 48 + (rand() - 0.5) * 3);
    readings.bearing_temp_f = round1(115 + stress * 42 + (rand() - 0.5) * 2);
    readings.discharge_temp_f = round1(readings.discharge_temp_f + stress * 28);
    readings.discharge_pressure_psig = round1(readings.discharge_pressure_psig + stress * 35);
    readings.percent_line_current = round1(Math.min(99, readings.percent_line_current + stress * 18));
    readings.percent_capacity = round1(Math.min(99, readings.percent_capacity + stress * 20));
    readings.saturated_condensing_temp_f = round1(readings.saturated_condensing_temp_f + stress * 10);
  }

  return readings;
}

function condenserStressReadings(chiller, ts, rand, profile, alarmAt, startTime) {
  const hoursToAlarm = (alarmAt - ts) / 3_600_000;
  const readings = normalReadings(chiller, ts, rand, profile, startTime);

  if (hoursToAlarm < 0) {
    readings.unit_run_status = 2;
    readings.percent_capacity = 0;
    readings.percent_line_current = 0;
    readings.leaving_chilled_water_f = round1(profile.sp + 4);
    readings.discharge_pressure_psig = round1(168 + rand() * 5);
    readings.leaving_condenser_water_f = round1(102 + rand() * 3);
    return readings;
  }

  if (hoursToAlarm < 20) {
    const stress = 1 - hoursToAlarm / 20;
    readings.discharge_pressure_psig = round1(readings.discharge_pressure_psig + stress * 30);
    readings.saturated_condensing_temp_f = round1(readings.saturated_condensing_temp_f + stress * 14);
    readings.leaving_condenser_water_f = round1(readings.leaving_condenser_water_f + stress * 8);
    readings.percent_line_current = round1(Math.min(98, readings.percent_line_current + stress * 8));
    readings.leaving_chilled_water_f = round1(readings.leaving_chilled_water_f + stress * 2.5);
  }

  return readings;
}

function stoppedReadings(chiller, ts, rand, profile, faultAt, startTime) {
  if (ts >= faultAt) {
    return {
      leaving_chilled_water_f: round1(profile.sp + 10 + rand() * 2),
      entering_chilled_water_f: round1(profile.sp + 16),
      saturated_condensing_temp_f: 0,
      saturated_suction_temp_f: 0,
      discharge_temp_f: 0,
      bearing_temp_f: round1(84 + rand() * 6),
      motor_winding_temp_f: round1(86 + rand() * 8),
      discharge_pressure_psig: 0,
      suction_pressure_psig: 0,
      percent_line_current: 0,
      line_voltage_v: round1(480 + rand() * 2),
      percent_capacity: 0,
      unit_run_status: 0,
      compressor_starts: profile.startsBase,
      run_hours: round1(profile.runHoursBase + (ts - startTime) / 3_600_000),
    };
  }
  return normalReadings(chiller, ts, rand, profile, startTime);
}

function readingsForChiller(chiller, ts, rand, alarmTimes, startTime) {
  const profile = baseProfile(chiller);
  const alarm = alarmTimes[chiller.chiller_id];

  if (chiller.chiller_id === "CH-ATL-003") {
    return heroDegradingReadings(chiller, ts, rand, profile, alarm.at, startTime);
  }
  if (chiller.chiller_id === "CH-DAL-002") {
    return condenserStressReadings(chiller, ts, rand, profile, alarm.at, startTime);
  }
  if (chiller.chiller_id === "CH-PHX-005") {
    return stoppedReadings(chiller, ts, rand, profile, alarm.at, startTime);
  }
  return normalReadings(chiller, ts, rand, profile, startTime);
}

/**
 * Generate 840 telemetry documents (7 days × hourly × 5 chillers) with
 * timestamps ending at `endTime` (a truncated-to-hour UTC millisecond value).
 * Documents use BSON Date objects so they are accepted by the time-series
 * collection timeField constraint.
 */
function buildTelemetry(chillers, endTime) {
  const intervalMs = TELEMETRY_INTERVAL_HOURS * 3_600_000;
  const totalPoints = TELEMETRY_DAYS * 24;
  const startTime = endTime - (totalPoints - 1) * intervalMs;

  const alarmTimes = Object.fromEntries(
    Object.entries(ALARM_OFFSETS_MS).map(([id, def]) => [
      id,
      { code: def.code, at: endTime - def.msBeforeEnd },
    ])
  );

  const documents = [];
  for (const chiller of chillers) {
    const seed =
      TELEMETRY_SEED +
      chiller.chiller_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = mulberry32(seed);

    for (let i = 0; i < totalPoints; i++) {
      const ts = startTime + i * intervalMs;
      documents.push({
        chiller_id: chiller.chiller_id,
        timestamp: new Date(ts),
        readings: readingsForChiller(chiller, ts, rand, alarmTimes, startTime),
      });
    }
  }

  documents.sort(
    (a, b) =>
      a.timestamp - b.timestamp ||
      a.chiller_id.localeCompare(b.chiller_id)
  );

  return documents;
}
