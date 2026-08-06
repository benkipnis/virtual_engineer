#!/usr/bin/env node
/**
 * Validate and (optionally) create the Atlas Search / Vector Search indexes
 * required by Virtual Engineer's hybrid search tools (see docs/indexes.md).
 *
 * Usage:
 *   node scripts/data/manage-search-indexes.js            # check status only
 *   node scripts/data/manage-search-indexes.js --create   # create any missing indexes
 *   node scripts/data/manage-search-indexes.js --create --wait   # create + poll until READY
 *
 * Requires an Atlas cluster tier that supports Search/Vector Search index
 * management via the driver (M10+, or Atlas Search Nodes). Not supported on
 * local mongod or M0/M2/M5 shared tiers.
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: join(rootDir, ".env") });

const DB_NAME = process.env.MONGODB_DB || "virtual_engineer";
const CREATE = process.argv.includes("--create");
const WAIT = process.argv.includes("--wait");
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function indexEnv(name, fallback) {
  return process.env[name] || fallback;
}

function buildIndexSpecs() {
  const knowledgeVectorIndex = indexEnv("KNOWLEDGE_VECTOR_INDEX", "knowledge_auto_embed_index");
  const knowledgeSearchIndex = indexEnv("KNOWLEDGE_SEARCH_INDEX", "knowledge_search");
  const ticketsVectorIndex = indexEnv("TICKETS_VECTOR_INDEX", "service_tickets_auto_embed_index");
  const ticketsSearchIndex = indexEnv("TICKETS_SEARCH_INDEX", "service_tickets_search");

  return [
    {
      collection: "knowledge_documents",
      name: knowledgeVectorIndex,
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "autoEmbed", modality: "text", path: "content", model: "voyage-4" },
          { type: "filter", path: "type" },
          { type: "filter", path: "model_families" },
          { type: "filter", path: "subsystem" },
          { type: "filter", path: "alarm_codes" },
        ],
      },
    },
    {
      collection: "knowledge_documents",
      name: knowledgeSearchIndex,
      type: "search",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            title: { type: "string", analyzer: "lucene.english" },
            content: { type: "string", analyzer: "lucene.english" },
            type: { type: "token" },
            model_families: { type: "token" },
            subsystem: { type: "token" },
            alarm_codes: { type: "token" },
          },
        },
      },
    },
    {
      collection: "service_tickets",
      name: ticketsVectorIndex,
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "autoEmbed", modality: "text", path: "searchable_narrative", model: "voyage-4-lite" },
          { type: "filter", path: "status" },
          { type: "filter", path: "related_alarm_codes" },
          { type: "filter", path: "chiller_id" },
          { type: "filter", path: "type" },
        ],
      },
    },
    {
      collection: "service_tickets",
      name: ticketsSearchIndex,
      type: "search",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            reported_symptom: { type: "string", analyzer: "lucene.english" },
            work_performed: { type: "string", analyzer: "lucene.english" },
            resolution: { type: "string", analyzer: "lucene.english" },
            root_cause: { type: "string", analyzer: "lucene.english" },
            searchable_narrative: { type: "string", analyzer: "lucene.english" },
            related_alarm_codes: { type: "token" },
            status: { type: "token" },
            type: { type: "token" },
            chiller_id: { type: "token" },
            ticket_id: { type: "token" },
          },
        },
      },
    },
  ];
}

async function findExisting(db, spec) {
  const existing = await db.collection(spec.collection).listSearchIndexes(spec.name).toArray();
  return existing[0] || null;
}

async function checkAndCreate(db, specs) {
  const results = [];
  for (const spec of specs) {
    let existing;
    try {
      existing = await findExisting(db, spec);
    } catch (err) {
      results.push({ ...spec, status: "ERROR", detail: err.message });
      continue;
    }

    if (existing) {
      results.push({ ...spec, status: existing.status || existing.queryable ? "READY" : "BUILDING", detail: null });
      continue;
    }

    if (!CREATE) {
      results.push({ ...spec, status: "MISSING", detail: "run with --create to provision" });
      continue;
    }

    try {
      await db.collection(spec.collection).createSearchIndex({
        name: spec.name,
        type: spec.type,
        definition: spec.definition,
      });
      results.push({ ...spec, status: "CREATED", detail: "initial sync in progress" });
    } catch (err) {
      results.push({ ...spec, status: "CREATE_FAILED", detail: err.message });
    }
  }
  return results;
}

async function pollUntilReady(db, specs) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  const pending = new Set(specs.map((s) => `${s.collection}.${s.name}`));

  while (pending.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    for (const spec of specs) {
      const key = `${spec.collection}.${spec.name}`;
      if (!pending.has(key)) continue;
      const existing = await findExisting(db, spec);
      const status = existing?.status || (existing?.queryable ? "READY" : "BUILDING");
      if (status === "READY" || status === "FAILED") {
        console.log(`  ${key}: ${status}`);
        pending.delete(key);
      }
    }
  }

  if (pending.size > 0) {
    console.log(`\nTimed out waiting for: ${[...pending].join(", ")}`);
  } else {
    console.log("\nAll indexes READY.");
  }
}

function printTable(results) {
  const rows = results.map((r) => ({
    Collection: r.collection,
    Index: r.name,
    Type: r.type,
    Status: r.status,
    Detail: r.detail || "",
  }));
  console.table(rows);
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
    console.log(`Connected to database: ${DB_NAME}\n`);

    const specs = buildIndexSpecs();
    const results = await checkAndCreate(db, specs);
    printTable(results);

    const missing = results.filter((r) => r.status === "MISSING");
    if (missing.length > 0 && !CREATE) {
      console.log(`\n${missing.length} index(es) missing. Re-run with --create to provision them.`);
    }

    const created = results.filter((r) => r.status === "CREATED");
    if (created.length > 0 && WAIT) {
      console.log("\nWaiting for newly created indexes to become READY...");
      await pollUntilReady(db, created);
    } else if (created.length > 0) {
      console.log("\nIndexes created — initial sync can take a few minutes. Re-run this script to check status, or use --wait next time.");
    }

    const failed = results.filter((r) => r.status === "ERROR" || r.status === "CREATE_FAILED");
    if (failed.length > 0) {
      console.log(
        "\nSome indexes could not be checked/created. This commonly happens on cluster tiers below M10 " +
          "(driver-based Search Index management requires M10+ or Atlas Search Nodes) — use the Atlas UI instead."
      );
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
