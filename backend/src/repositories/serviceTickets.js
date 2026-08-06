import { getDb } from "../db/client.js";
import { env } from "../config/env.js";

function buildSearchableNarrative(ticket) {
  return [ticket.reported_symptom, ticket.work_performed, ticket.resolution, ticket.root_cause]
    .filter(Boolean)
    .join("\n\n");
}

export async function getServiceHistory(chillerId, limit = 20) {
  const db = await getDb();
  return db
    .collection("service_tickets")
    .find({ chiller_id: chillerId })
    .sort({ opened_at: -1 })
    .limit(limit)
    .toArray();
}

export async function getPartsHistory(chillerId) {
  const db = await getDb();
  const tickets = await db
    .collection("service_tickets")
    .find({ chiller_id: chillerId, "parts_replaced.0": { $exists: true } })
    .sort({ opened_at: -1 })
    .toArray();

  const parts = [];
  for (const ticket of tickets) {
    for (const part of ticket.parts_replaced || []) {
      parts.push({
        ticket_id: ticket.ticket_id,
        opened_at: ticket.opened_at,
        ...part,
      });
    }
  }
  return parts;
}

export async function filterCases({ productFamily, alarmCategory, status, limit = 20 }) {
  const db = await getDb();
  const pipeline = [
    {
      $lookup: {
        from: "chillers",
        localField: "chiller_id",
        foreignField: "chiller_id",
        as: "chiller",
      },
    },
    { $unwind: "$chiller" },
  ];

  const match = {};
  if (productFamily) match["chiller.model_family"] = productFamily;
  if (status) match.status = status;
  if (alarmCategory) match.related_alarm_codes = alarmCategory;
  if (Object.keys(match).length) pipeline.push({ $match: match });

  pipeline.push({ $sort: { opened_at: -1 } }, { $limit: limit });
  return db.collection("service_tickets").aggregate(pipeline).toArray();
}

const CASE_HYBRID_WEIGHTS = { vector: 0.5, text: 0.5 };

function buildCaseFilterClauses(filters = {}) {
  const clauses = [];
  if (filters.status) clauses.push({ equals: { path: "status", value: filters.status } });
  if (filters.chiller_id) {
    clauses.push({ equals: { path: "chiller_id", value: filters.chiller_id } });
  }
  if (filters.related_alarm_codes?.length) {
    clauses.push({ in: { path: "related_alarm_codes", value: filters.related_alarm_codes } });
  }
  return clauses;
}

export async function searchCaseNotesHybrid(query, filters = {}, limit = 10) {
  const db = await getDb();
  const vectorFilter = {};
  if (filters.status) vectorFilter.status = { $eq: filters.status };
  if (filters.chiller_id) vectorFilter.chiller_id = { $eq: filters.chiller_id };
  if (filters.related_alarm_codes?.length) {
    vectorFilter.related_alarm_codes = { $in: filters.related_alarm_codes };
  }
  const filterClauses = buildCaseFilterClauses(filters);

  const pipeline = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [
              {
                $vectorSearch: {
                  index: env.ticketsVectorIndex,
                  path: "searchable_narrative",
                  query: { text: query },
                  numCandidates: 50,
                  limit,
                  ...(Object.keys(vectorFilter).length ? { filter: vectorFilter } : {}),
                },
              },
            ],
            text: [
              {
                $search: {
                  index: env.ticketsSearchIndex,
                  compound: {
                    must: [
                      {
                        text: {
                          query,
                          path: [
                            "reported_symptom",
                            "work_performed",
                            "resolution",
                            "root_cause",
                            "searchable_narrative",
                          ],
                        },
                      },
                    ],
                    ...(filterClauses.length ? { filter: filterClauses } : {}),
                  },
                },
              },
              { $limit: limit },
            ],
          },
        },
        combination: { weights: CASE_HYBRID_WEIGHTS },
        scoreDetails: true,
      },
    },
    { $limit: limit },
    {
      $addFields: {
        rrf_score: { $meta: "score" },
        score_details: { $meta: "searchScoreDetails" },
      },
    },
    {
      $project: {
        ticket_id: 1,
        chiller_id: 1,
        status: 1,
        reported_symptom: 1,
        work_performed: 1,
        resolution: 1,
        root_cause: 1,
        related_alarm_codes: 1,
        rrf_score: 1,
        score_details: 1,
      },
    },
  ];

  return db.collection("service_tickets").aggregate(pipeline).toArray();
}

export function rerankSimilarCases(results, context = {}) {
  const alarmCodes = new Set(context.alarm_codes || context.active_alarm_codes || []);
  const modelFamily = context.model_family;

  return [...results]
    .map((item) => {
      let boost = item.rrf_score ?? item.score ?? 0;
      const sharedAlarms = (item.related_alarm_codes || []).filter((c) => alarmCodes.has(c)).length;
      boost += sharedAlarms * 0.15;
      if (modelFamily && item.chiller?.model_family === modelFamily) boost += 0.1;
      return { ...item, rerank_score: boost };
    })
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));
}

export { buildSearchableNarrative };
