#!/usr/bin/env node
/**
 * Generate 7-day hourly telemetry for all demo chillers.
 *
 * Usage:
 *   node scripts/data/generate-telemetry.js
 *   node scripts/data/generate-telemetry.js --days 7 --interval-hours 1 --seed 42
 *   node scripts/data/generate-telemetry.js --output scripts/data/samples/telemetry.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHILLERS_PATH = join(__dirname, "samples", "chillers.json");
const DEFAULT_OUTPUT = join(__dirname, "samples", "telemetry.json");

const ALARM_TIMES = {
  "CH-ATL-003": { code: "A1.01", at: Date.parse("2026-07-17T14:22:18Z") },
  "CH-DAL-002": { code: "207", at: Date.parse("2026-07-16T22:08:00Z") },
  "CH-PHX-005": { code: "Co.A1", at: Date.parse("2026-07-17T12:05:00Z") },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    days: 7,
    intervalHours: 1,
    seed: 42,
    output: DEFAULT_OUTPUT,
    endTime: Date.parse("2026-07-17T17:00:00Z"),
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days") opts.days = Number(args[++i]);
    else if (args[i] === "--interval-hours") opts.intervalHours = Number(args[++i]);
    else if (args[i] === "--seed") opts.seed = Number(args[++i]);
    else if (args[i] === "--output") opts.output = args[++i];
    else if (args[i] === "--end-time") opts.endTime = Date.parse(args[++i]);
  }
  return opts;
}

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

function loadChillers() {
  return JSON.parse(readFileSync(CHILLERS_PATH, "utf8"));
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

function normalReadings(chiller, ts, rand, profile) {
  const hour = new Date(ts).getUTCHours();
  const dayOffset = (ts - Date.parse("2026-07-10T17:00:00Z")) / 3600000;

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

function heroDegradingReadings(chiller, ts, rand, profile, alarmAt) {
  const hoursToAlarm = (alarmAt - ts) / 3600000;

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
      run_hours: round1(profile.runHoursBase + (ts - Date.parse("2026-07-10T17:00:00Z")) / 3600000),
    };
  }

  const readings = normalReadings(chiller, ts, rand, profile);

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

function condenserStressReadings(chiller, ts, rand, profile, alarmAt) {
  const hoursToAlarm = (alarmAt - ts) / 3600000;
  const readings = normalReadings(chiller, ts, rand, profile);

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

function stoppedReadings(chiller, ts, rand, profile, faultAt) {
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
      run_hours: round1(profile.runHoursBase + (ts - Date.parse("2026-07-10T17:00:00Z")) / 3600000),
    };
  }
  return normalReadings(chiller, ts, rand, profile);
}

function readingsForChiller(chiller, ts, rand) {
  const profile = baseProfile(chiller);
  const alarm = ALARM_TIMES[chiller.chiller_id];

  if (chiller.chiller_id === "CH-ATL-003") {
    return heroDegradingReadings(chiller, ts, rand, profile, alarm.at);
  }
  if (chiller.chiller_id === "CH-DAL-002") {
    return condenserStressReadings(chiller, ts, rand, profile, alarm.at);
  }
  if (chiller.chiller_id === "CH-PHX-005") {
    return stoppedReadings(chiller, ts, rand, profile, alarm.at);
  }
  return normalReadings(chiller, ts, rand, profile);
}

export function generateTelemetry(opts = {}) {
  const {
    days = 7,
    intervalHours = 1,
    seed = 42,
    endTime = Date.parse("2026-07-17T17:00:00Z"),
  } = opts;

  const chillers = loadChillers();
  const intervalMs = intervalHours * 3600000;
  const totalPoints = Math.floor((days * 24) / intervalHours);
  const startTime = endTime - (totalPoints - 1) * intervalMs;

  const documents = [];
  for (const chiller of chillers) {
    const rand = mulberry32(seed + chiller.chiller_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
    for (let i = 0; i < totalPoints; i++) {
      const ts = startTime + i * intervalMs;
      documents.push({
        chiller_id: chiller.chiller_id,
        timestamp: new Date(ts).toISOString(),
        readings: readingsForChiller(chiller, ts, rand),
      });
    }
  }

  documents.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.chiller_id.localeCompare(b.chiller_id));
  return documents;
}

function main() {
  const opts = parseArgs();
  const documents = generateTelemetry(opts);
  writeFileSync(opts.output, JSON.stringify(documents, null, 2) + "\n");

  const byChiller = {};
  for (const d of documents) {
    byChiller[d.chiller_id] = (byChiller[d.chiller_id] ?? 0) + 1;
  }

  console.log(`Wrote ${documents.length} telemetry documents to ${opts.output}`);
  console.log(`Time range: ${documents[0].timestamp} → ${documents[documents.length - 1].timestamp}`);
  console.log("Per chiller:", byChiller);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
