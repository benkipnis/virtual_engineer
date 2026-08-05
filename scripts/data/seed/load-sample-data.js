#!/usr/bin/env node
/**
 * Load Virtual Engineer sample data into MongoDB.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/data/seed/load-sample-data.js
 *   MONGODB_URI="..." node scripts/data/seed/load-sample-data.js --drop
 *
 * Environment:
 *   MONGODB_URI  — required connection string
 *   MONGODB_DB   — database name (default: virtual_engineer)
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { generateTelemetry } from "../generate-telemetry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..", "..", "..");

config({ path: join(ROOT_DIR, ".env") });
const SAMPLES_DIR = join(__dirname, "..", "samples");
const DB_NAME = process.env.MONGODB_DB || "virtual_engineer";
const DROP = process.argv.includes("--drop");
const REGENERATE_TELEMETRY = !process.argv.includes("--no-regenerate-telemetry");

const COLLECTIONS = [
  "sites",
  "chillers",
  "alarm_definitions",
  "alarm_events",
  "telemetry",
  "service_tickets",
  "knowledge_documents",
];

const DATE_FIELDS = {
  alarm_events: ["raised_at", "cleared_at"],
  service_tickets: ["opened_at", "closed_at"],
};

function toDate(value) {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

function buildSearchableNarrative(ticket) {
  const sections = [
    ticket.reported_symptom,
    ticket.work_performed,
    ticket.resolution,
    ticket.root_cause,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);

  if (sections.length === 0) return "";

  return sections.join("\n\n");
}

function withSearchableNarrative(ticket) {
  return {
    ...ticket,
    searchable_narrative: ticket.searchable_narrative || buildSearchableNarrative(ticket),
  };
}

function prepareDateFields(docs, fields) {
  return docs.map((doc) => {
    const next = { ...doc };
    for (const field of fields) {
      if (field in next) next[field] = toDate(next[field]);
    }
    return next;
  });
}

function loadJson(filename) {
  const raw = readFileSync(join(SAMPLES_DIR, filename), "utf8");
  return JSON.parse(raw);
}

/** Time series collections require the timeField as a BSON Date, not an ISO string. */
function prepareTelemetryDocs(docs) {
  return docs.map((doc) => ({
    ...doc,
    timestamp: doc.timestamp instanceof Date ? doc.timestamp : new Date(doc.timestamp),
  }));
}

function prepareDocsForCollection(name, docs) {
  if (name === "telemetry") {
    return prepareTelemetryDocs(docs);
  }
  if (DATE_FIELDS[name]) {
    return prepareDateFields(docs, DATE_FIELDS[name]);
  }
  if (name === "service_tickets") {
    return docs.map((doc) =>
      withSearchableNarrative(prepareDateFields([doc], DATE_FIELDS.service_tickets)[0])
    );
  }
  return docs;
}

async function ensureTelemetryTimeSeries(db) {
  const collections = await db.listCollections({ name: "telemetry" }).toArray();
  if (collections.length > 0) {
    return;
  }
  await db.createCollection("telemetry", {
    timeseries: {
      timeField: "timestamp",
      metaField: "chiller_id",
      granularity: "minutes",
    },
  });
  console.log("Created time series collection: telemetry");
}

async function createIndexes(db) {
  await db.collection("sites").createIndex({ site_id: 1 }, { unique: true });

  await db.collection("chillers").createIndex({ chiller_id: 1 }, { unique: true });
  await db.collection("chillers").createIndex({ site_id: 1 });
  await db.collection("chillers").createIndex({ serial_number: 1 });

  await db.collection("chillers").createIndex({ model_family: 1 });

  await db.collection("alarm_definitions").createIndex({ alarm_code: 1 }, { unique: true });
  await db.collection("alarm_definitions").createIndex({ model_families: 1, subsystem: 1 });

  await db.collection("alarm_events").createIndex({ chiller_id: 1, status: 1 });
  await db.collection("alarm_events").createIndex({ chiller_id: 1, raised_at: -1 });
  await db.collection("alarm_events").createIndex({ alarm_code: 1 });

  await db.collection("service_tickets").createIndex({ chiller_id: 1, opened_at: -1 });
  await db.collection("service_tickets").createIndex({ status: 1 });
  await db.collection("service_tickets").createIndex({ related_alarm_codes: 1 });

  await db.collection("knowledge_documents").createIndex({ doc_id: 1 }, { unique: true });
  await db.collection("knowledge_documents").createIndex({ type: 1, model_families: 1 });

  console.log("Indexes created");
}

/** Ensure searchable_narrative exists on all tickets (for Atlas autoEmbed index). */
async function backfillSearchableNarrative(db) {
  const coll = db.collection("service_tickets");
  const tickets = await coll.find({}).toArray();
  if (tickets.length === 0) return 0;

  const ops = [];
  for (const ticket of tickets) {
    const narrative = buildSearchableNarrative(ticket);
    if (ticket.searchable_narrative !== narrative) {
      ops.push({
        updateOne: {
          filter: { _id: ticket._id },
          update: { $set: { searchable_narrative: narrative } },
        },
      });
    }
  }

  if (ops.length > 0) {
    await coll.bulkWrite(ops);
  }
  return ops.length;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI environment variable is required");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log(`Connected to database: ${DB_NAME}`);

    if (DROP) {
      for (const name of COLLECTIONS) {
        const exists = await db.listCollections({ name }).toArray();
        if (exists.length > 0) {
          await db.collection(name).drop();
          console.log(`Dropped collection: ${name}`);
        }
      }
    }

    await ensureTelemetryTimeSeries(db);

    let telemetryDocs = null;
    if (REGENERATE_TELEMETRY) {
      telemetryDocs = generateTelemetry();
      console.log(`Regenerated ${telemetryDocs.length} telemetry documents (7-day hourly)`);
    }

    const counts = {};
    for (const name of COLLECTIONS) {
      const docs = name === "telemetry" && telemetryDocs ? telemetryDocs : loadJson(`${name}.json`);
      if (docs.length === 0) continue;

      if (DROP || (await db.collection(name).countDocuments()) === 0) {
        const prepared = prepareDocsForCollection(name, docs);
        const result = await db.collection(name).insertMany(prepared);
        counts[name] = result.insertedCount;
      } else {
        console.log(`Skipping ${name} — collection not empty (use --drop to replace)`);
        counts[name] = 0;
      }
    }

    await createIndexes(db);

    const narrativeUpdates = await backfillSearchableNarrative(db);
    if (narrativeUpdates > 0) {
      console.log(`Backfilled searchable_narrative on ${narrativeUpdates} service_tickets`);
    }

    console.log("\nInsert summary:");
    for (const [name, count] of Object.entries(counts)) {
      console.log(`  ${name}: ${count} documents`);
    }
    console.log("\nDone.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
