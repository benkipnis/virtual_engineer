import { getDb } from "../db/client.js";

export async function getAlarmDefinition(alarmCode) {
  const db = await getDb();
  return db.collection("alarm_definitions").findOne({ alarm_code: alarmCode });
}

export async function getActiveAlarms(chillerId) {
  const db = await getDb();
  return db
    .collection("alarm_events")
    .aggregate([
      { $match: { chiller_id: chillerId, status: "active" } },
      { $sort: { raised_at: -1 } },
      {
        $lookup: {
          from: "alarm_definitions",
          localField: "alarm_code",
          foreignField: "alarm_code",
          as: "definition",
        },
      },
      { $unwind: { path: "$definition", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();
}

export async function getAlarmHistory(chillerId, lookbackHours = 168) {
  const db = await getDb();
  const since = new Date(Date.now() - lookbackHours * 3600000);
  return db
    .collection("alarm_events")
    .aggregate([
      { $match: { chiller_id: chillerId, raised_at: { $gte: since } } },
      { $sort: { raised_at: -1 } },
      {
        $lookup: {
          from: "alarm_definitions",
          localField: "alarm_code",
          foreignField: "alarm_code",
          as: "definition",
        },
      },
      { $unwind: { path: "$definition", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();
}
