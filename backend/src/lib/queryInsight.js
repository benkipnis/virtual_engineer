import { env } from "../config/env.js";

export const PATTERNS = {
  EXACT_FIND: "exact_find",
  AGGREGATION_LOOKUP: "aggregation_lookup",
  TIME_SERIES_WINDOW: "time_series_window",
  VECTOR_SEARCH: "vector_search",
  ATLAS_SEARCH: "atlas_search",
  HYBRID_SEARCH: "hybrid_search",
  IN_MEMORY: "in_memory",
  WRITE: "write",
  NOT_CONFIGURED: "not_configured",
};

function excerpt(obj) {
  return JSON.stringify(obj, null, 2);
}

export function insightForChillerById(chillerId) {
  return {
    pattern: PATTERNS.EXACT_FIND,
    collection: "chillers",
    query_excerpt: excerpt({ chiller_id: chillerId }),
  };
}

export function insightForSiteContext(chillerId) {
  return {
    pattern: PATTERNS.EXACT_FIND,
    collection: "chillers,sites",
    query_excerpt: excerpt([
      { collection: "chillers", filter: { chiller_id: chillerId } },
      { collection: "sites", filter: { site_id: "<from chiller.site_id>" } },
    ]),
  };
}

export function insightForActiveAlarms(chillerId) {
  return {
    pattern: PATTERNS.AGGREGATION_LOOKUP,
    collection: "alarm_events",
    query_excerpt: excerpt([
      { $match: { chiller_id: chillerId, status: "active" } },
      { $lookup: { from: "alarm_definitions", localField: "alarm_code", foreignField: "alarm_code" } },
    ]),
  };
}

export function insightForAlarmHistory(chillerId, lookbackHours) {
  return {
    pattern: PATTERNS.AGGREGATION_LOOKUP,
    collection: "alarm_events",
    query_excerpt: excerpt([
      { $match: { chiller_id: chillerId, raised_at: { $gte: `now-${lookbackHours}h` } } },
      { $lookup: { from: "alarm_definitions", localField: "alarm_code", foreignField: "alarm_code" } },
    ]),
  };
}

export function insightForAlarmDefinition(alarmCode) {
  return {
    pattern: PATTERNS.EXACT_FIND,
    collection: "alarm_definitions",
    query_excerpt: excerpt({ alarm_code: alarmCode }),
  };
}

export function insightForTelemetryWindow(chillerId, startTime, endTime) {
  return {
    pattern: PATTERNS.TIME_SERIES_WINDOW,
    collection: "telemetry",
    query_excerpt: excerpt({
      chiller_id: chillerId,
      timestamp: { $gte: startTime, $lte: endTime },
    }),
  };
}

export function insightForLatestTelemetry(chillerId) {
  return {
    pattern: PATTERNS.TIME_SERIES_WINDOW,
    collection: "telemetry",
    query_excerpt: excerpt({ chiller_id: chillerId, sort: { timestamp: -1 }, limit: 1 }),
  };
}

export function insightForServiceHistory(chillerId) {
  return {
    pattern: PATTERNS.EXACT_FIND,
    collection: "service_tickets",
    query_excerpt: excerpt({ chiller_id: chillerId, sort: { opened_at: -1 } }),
  };
}

export function insightForPartsHistory(chillerId) {
  return {
    pattern: PATTERNS.EXACT_FIND,
    collection: "service_tickets",
    query_excerpt: excerpt({
      chiller_id: chillerId,
      "parts_replaced.0": { $exists: true },
    }),
  };
}

function toRankFusionLegs(scoreDetails) {
  if (!scoreDetails?.length) return undefined;
  return scoreDetails.map((d) => ({
    pipeline: d.inputPipelineName,
    rank: d.rank ?? null,
    weight: d.weight ?? 1,
  }));
}

export function insightForKnowledgeSearch(query, type, filters, scoreDetails = null) {
  return {
    pattern: PATTERNS.HYBRID_SEARCH,
    collection: "knowledge_documents",
    index: `${env.knowledgeVectorIndex},${env.knowledgeSearchIndex}`,
    query_excerpt: excerpt({
      $rankFusion: {
        input: {
          pipelines: {
            vector: [
              {
                $vectorSearch: {
                  index: env.knowledgeVectorIndex,
                  path: "content",
                  query: { text: query },
                  filter: { type, ...filters },
                },
              },
            ],
            text: [
              {
                $search: {
                  index: env.knowledgeSearchIndex,
                  compound: { must: [{ text: { query, path: ["title", "content"] } }] },
                },
              },
            ],
          },
        },
        combination: { weights: { vector: 0.5, text: 0.5 } },
      },
    }),
    rank_fusion_legs: toRankFusionLegs(scoreDetails),
  };
}

export function insightForCaseSearch(query, filters, scoreDetails = null) {
  return {
    pattern: PATTERNS.HYBRID_SEARCH,
    collection: "service_tickets",
    index: `${env.ticketsVectorIndex},${env.ticketsSearchIndex}`,
    query_excerpt: excerpt({
      $rankFusion: {
        input: {
          pipelines: {
            vector: [
              {
                $vectorSearch: {
                  index: env.ticketsVectorIndex,
                  path: "searchable_narrative",
                  query: { text: query },
                  filter: filters,
                },
              },
            ],
            text: [
              {
                $search: {
                  index: env.ticketsSearchIndex,
                  compound: { must: [{ text: { query, path: "searchable_narrative" } }] },
                },
              },
            ],
          },
        },
        combination: { weights: { vector: 0.5, text: 0.5 } },
      },
    }),
    rank_fusion_legs: toRankFusionLegs(scoreDetails),
  };
}

export function insightForFilterCases({ productFamily, alarmCategory, status }) {
  return {
    pattern: PATTERNS.AGGREGATION_LOOKUP,
    collection: "service_tickets",
    query_excerpt: excerpt([
      { $lookup: { from: "chillers", localField: "chiller_id", foreignField: "chiller_id" } },
      {
        $match: {
          "chiller.model_family": productFamily || undefined,
          related_alarm_codes: alarmCategory || undefined,
          status: status || undefined,
        },
      },
    ]),
  };
}

export function insightForRerank(type) {
  return {
    pattern: PATTERNS.IN_MEMORY,
    collection: type === "cases" ? "service_tickets" : "knowledge_documents",
    query_excerpt: "In-memory re-rank by alarm code overlap and model family match",
  };
}

export function insightForSessionWrite(collection, operation) {
  return {
    pattern: PATTERNS.WRITE,
    collection,
    query_excerpt: operation,
  };
}

export function insightForNotConfigured(collection) {
  return {
    pattern: PATTERNS.NOT_CONFIGURED,
    collection,
    query_excerpt: "Collection not yet provisioned",
  };
}

export function attachInsight(result, queryInsight) {
  if (!queryInsight) return result;
  return { ...result, query_insight: queryInsight };
}
