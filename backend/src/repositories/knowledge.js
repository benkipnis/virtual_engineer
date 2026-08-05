import { getDb } from "../db/client.js";
import { env } from "../config/env.js";

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

  const pipeline = [
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
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  return db.collection("knowledge_documents").aggregate(pipeline).toArray();
}

export async function searchKnowledgeRegex({ query, type, filters = {}, limit = 10 }) {
  const db = await getDb();
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  const match = { type };
  if (terms.length > 0) {
    match.$or = terms.map((term) => ({ content: { $regex: term, $options: "i" } }));
  } else {
    match.content = { $regex: query, $options: "i" };
  }
  if (filters.model_family) match.model_families = filters.model_family;
  if (filters.subsystem) match.subsystem = filters.subsystem;
  if (filters.alarm_codes?.length) {
    match.alarm_codes = { $in: filters.alarm_codes };
  }

  return db
    .collection("knowledge_documents")
    .find(match)
    .limit(limit)
    .project({
      doc_id: 1,
      type: 1,
      title: 1,
      content: 1,
      model_families: 1,
      subsystem: 1,
      alarm_codes: 1,
      source: 1,
    })
    .toArray();
}

export function rerankKnowledgeResults(results, context = {}) {
  const alarmCodes = new Set(context.alarm_codes || context.active_alarm_codes || []);
  const modelFamily = context.model_family;

  return [...results]
    .map((item) => {
      let boost = item.score ?? 0;
      const sharedAlarms = (item.alarm_codes || []).filter((c) => alarmCodes.has(c)).length;
      boost += sharedAlarms * 0.2;
      if (modelFamily && (item.model_families || []).includes(modelFamily)) boost += 0.15;
      if (context.subsystem && item.subsystem === context.subsystem) boost += 0.1;
      return { ...item, rerank_score: boost };
    })
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));
}
