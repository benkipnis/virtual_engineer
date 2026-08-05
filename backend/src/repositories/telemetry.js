import { getDb } from "../db/client.js";

export async function getTelemetryWindow(chillerId, startTime, endTime) {
  const db = await getDb();
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  return db
    .collection("telemetry")
    .find({
      chiller_id: chillerId,
      timestamp: { $gte: start, $lte: end },
    })
    .sort({ timestamp: 1 })
    .toArray();
}

export async function getLatestTelemetry(chillerId) {
  const db = await getDb();
  const docs = await db
    .collection("telemetry")
    .find({ chiller_id: chillerId })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();
  return docs[0] ?? null;
}
