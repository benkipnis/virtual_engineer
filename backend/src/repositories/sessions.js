import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

export async function startSession({ chillerId, userId, problemContext }) {
  const db = await getDb();
  const sessionId = `SES-${randomUUID().slice(0, 8).toUpperCase()}`;
  const doc = {
    session_id: sessionId,
    chiller_id: chillerId,
    user_id: userId,
    problem_context: problemContext || null,
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
    resolution: null,
  };
  await db.collection("troubleshooting_sessions").insertOne(doc);
  return doc;
}

export async function getSession(sessionId) {
  const db = await getDb();
  return db.collection("troubleshooting_sessions").findOne({ session_id: sessionId });
}

export async function storeRecommendationTrace({ sessionId, sourceDataRefs, inferredOutputs }) {
  const db = await getDb();
  const trace = {
    trace_id: `TRC-${randomUUID().slice(0, 8).toUpperCase()}`,
    session_id: sessionId,
    source_data_refs: sourceDataRefs,
    inferred_outputs: inferredOutputs,
    created_at: new Date(),
  };
  await db.collection("recommendation_traces").insertOne(trace);
  await db.collection("troubleshooting_sessions").updateOne(
    { session_id: sessionId },
    { $set: { updated_at: new Date() } }
  );
  return trace;
}

export async function captureEngineerReaction({ sessionId, signal, notes }) {
  const db = await getDb();
  const feedback = {
    feedback_id: `FB-${randomUUID().slice(0, 8).toUpperCase()}`,
    session_id: sessionId,
    signal,
    notes: notes || null,
    created_at: new Date(),
  };
  await db.collection("engineer_feedback").insertOne(feedback);
  await db.collection("troubleshooting_sessions").updateOne(
    { session_id: sessionId },
    { $set: { updated_at: new Date() } }
  );
  return feedback;
}

export async function captureResolutionOutcome({ sessionId, diagnosis, repairNotes, resolution }) {
  const db = await getDb();
  const feedback = {
    feedback_id: `FB-${randomUUID().slice(0, 8).toUpperCase()}`,
    session_id: sessionId,
    signal: "resolution",
    diagnosis,
    repair_notes: repairNotes,
    resolution,
    created_at: new Date(),
  };
  await db.collection("engineer_feedback").insertOne(feedback);
  await db.collection("troubleshooting_sessions").updateOne(
    { session_id: sessionId },
    {
      $set: {
        status: "resolved",
        resolution,
        diagnosis,
        repair_notes: repairNotes,
        updated_at: new Date(),
        resolved_at: new Date(),
      },
    }
  );
  return feedback;
}

export async function ensureSessionIndexes() {
  const db = await getDb();
  await db.collection("troubleshooting_sessions").createIndex({ session_id: 1 }, { unique: true });
  await db.collection("troubleshooting_sessions").createIndex({ chiller_id: 1, created_at: -1 });
  await db.collection("troubleshooting_sessions").createIndex({ user_id: 1, created_at: -1 });
  await db.collection("recommendation_traces").createIndex({ session_id: 1, created_at: -1 });
  await db.collection("engineer_feedback").createIndex({ session_id: 1, created_at: -1 });
}
