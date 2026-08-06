import { getDb } from "../db/client.js";
import { env } from "../config/env.js";

const HYBRID_WEIGHTS = { vector: 0.5, text: 0.5 };

function buildKnowledgeFilterClauses(type, filters = {}) {
  const clauses = [{ equals: { path: "type", value: type } }];
  if (filters.model_family) {
    clauses.push({ in: { path: "model_families", value: [filters.model_family] } });
  }
  if (filters.subsystem) {
    clauses.push({ equals: { path: "subsystem", value: filters.subsystem } });
  }
  if (filters.alarm_codes?.length) {
    clauses.push({ in: { path: "alarm_codes", value: filters.alarm_codes } });
  }
  return clauses;
}

export async function searchKnowledge({ query, type, filters = {}, limit = 10 }) {
  const db = await getDb();
  const vectorFilter = { type: { $eq: type } };
  if (filters.model_family) {
    vectorFilter.model_families = { $in: [filters.model_family] };
  }
  if (filters.subsystem) {
    vectorFilter.subsystem = { $eq: filters.subsystem };
  }
  if (filters.alarm_codes?.length) {
    vectorFilter.alarm_codes = { $in: filters.alarm_codes };
  }

  const filterClauses = buildKnowledgeFilterClauses(type, filters);

  const pipeline = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [
              {
                $vectorSearch: {
                  index: env.knowledgeVectorIndex,
                  path: "content",
                  query: { text: query },
                  numCandidates: 100,
                  limit,
                  filter: vectorFilter,
                },
              },
            ],
            text: [
              {
                $search: {
                  index: env.knowledgeSearchIndex,
                  compound: {
                    must: [{ text: { query, path: ["title", "content"] } }],
                    filter: filterClauses,
                  },
                },
              },
              { $limit: limit },
            ],
          },
        },
        combination: { weights: HYBRID_WEIGHTS },
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
        doc_id: 1,
        type: 1,
        title: 1,
        content: 1,
        model_families: 1,
        subsystem: 1,
        alarm_codes: 1,
        source: 1,
        rrf_score: 1,
        score_details: 1,
      },
    },
  ];

  return db.collection("knowledge_documents").aggregate(pipeline).toArray();
}

export function rerankKnowledgeResults(results, context = {}) {
  const alarmCodes = new Set(context.alarm_codes || context.active_alarm_codes || []);
  const modelFamily = context.model_family;

  return [...results]
    .map((item) => {
      let boost = item.rrf_score ?? item.score ?? 0;
      const sharedAlarms = (item.alarm_codes || []).filter((c) => alarmCodes.has(c)).length;
      boost += sharedAlarms * 0.2;
      if (modelFamily && (item.model_families || []).includes(modelFamily)) boost += 0.15;
      if (context.subsystem && item.subsystem === context.subsystem) boost += 0.1;
      return { ...item, rerank_score: boost };
    })
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));
}
