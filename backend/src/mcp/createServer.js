import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getChillerById,
  getSiteContextForChiller,
} from "../repositories/chillers.js";
import {
  getActiveAlarms,
  getAlarmHistory,
  getAlarmDefinition,
} from "../repositories/alarms.js";
import { getLatestTelemetry, getTelemetryWindow } from "../repositories/telemetry.js";
import {
  filterCases,
  getPartsHistory,
  getServiceHistory,
  rerankSimilarCases,
  searchCaseNotesRegex,
  searchCaseNotesText,
  searchCaseNotesVector,
} from "../repositories/serviceTickets.js";
import {
  rerankKnowledgeResults,
  searchKnowledge,
  searchKnowledgeRegex,
} from "../repositories/knowledge.js";
import {
  captureEngineerReaction,
  captureResolutionOutcome,
  startSession,
  storeRecommendationTrace,
} from "../repositories/sessions.js";
import { asMcpText, toolDegraded, toolNotConfigured, toolNotFound, toolOk } from "../lib/response.js";
import {
  insightForActiveAlarms,
  insightForAlarmDefinition,
  insightForAlarmHistory,
  insightForCaseSearch,
  insightForChillerById,
  insightForFilterCases,
  insightForKnowledgeSearch,
  insightForLatestTelemetry,
  insightForNotConfigured,
  insightForPartsHistory,
  insightForRerank,
  insightForServiceHistory,
  insightForSessionWrite,
  insightForSiteContext,
  insightForTelemetryWindow,
} from "../lib/queryInsight.js";

const filtersSchema = z
  .object({
    model_family: z.string().optional(),
    subsystem: z.string().optional(),
    alarm_codes: z.array(z.string()).optional(),
  })
  .optional();

const contextSchema = z
  .object({
    model_family: z.string().optional(),
    subsystem: z.string().optional(),
    alarm_codes: z.array(z.string()).optional(),
    active_alarm_codes: z.array(z.string()).optional(),
  })
  .optional();

async function tryKnowledgeSearch(query, type, filters) {
  let vectorError;
  try {
    const results = await searchKnowledge({ query, type, filters });
    if (results.length > 0) {
      return toolOk(
        { results, type },
        results.map((r) => ({ collection: "knowledge_documents", id: r.doc_id })),
        { query_insight: insightForKnowledgeSearch(query, type, filters, true) }
      );
    }
  } catch (err) {
    vectorError = err;
  }

  const fallback = await searchKnowledgeRegex({ query, type, filters });
  if (fallback.length) {
    const reason = vectorError
      ? `Vector search unavailable (${vectorError.message}); using regex fallback`
      : "Vector search returned no results; using regex fallback";
    return toolDegraded(
      { results: fallback, type },
      reason,
      fallback.map((r) => ({ collection: "knowledge_documents", id: r.doc_id })),
      { query_insight: insightForKnowledgeSearch(query, type, filters, false) }
    );
  }

  const message = vectorError ? `Knowledge search degraded: ${vectorError.message}` : "No knowledge matches found";
  return toolDegraded(
    { results: [], type },
    message,
    [],
    { query_insight: insightForKnowledgeSearch(query, type, filters, false) }
  );
}

async function tryCaseSearch(query, filters) {
  const merged = [];
  const messages = [];
  const legs = [];

  try {
    const vector = await searchCaseNotesVector(query, filters);
    merged.push(...vector);
    if (vector.length) legs.push("vector");
  } catch (err) {
    messages.push(`vector: ${err.message}`);
  }

  try {
    const text = await searchCaseNotesText(query, filters);
    merged.push(...text);
    if (text.length) legs.push("text");
  } catch (err) {
    messages.push(`text: ${err.message}`);
  }

  const insight = insightForCaseSearch(query, filters, legs.length ? legs : ["regex"]);

  if (!merged.length) {
    const regex = await searchCaseNotesRegex(query, filters);
    return toolDegraded(
      { results: regex },
      messages.length ? `Search indexes unavailable (${messages.join("; ")}); regex fallback` : "Regex fallback",
      [],
      { query_insight: insightForCaseSearch(query, filters, ["regex"]) }
    );
  }

  const byId = new Map();
  for (const item of merged) {
    const existing = byId.get(item.ticket_id);
    if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
      byId.set(item.ticket_id, item);
    }
  }

  const degraded = messages.length > 0;
  const results = [...byId.values()];
  if (degraded) {
    return toolDegraded({ results }, messages.join("; "), [], { query_insight: insight });
  }
  return toolOk({ results }, [], { query_insight: insight });
}

export function createMcpServer() {
  const server = new McpServer({
    name: "virtual-engineer",
    version: "0.1.0",
  });

  server.registerTool(
    "getChillerById",
    {
      description: "Resolve exact chiller asset record by chiller_id",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const chiller = await getChillerById(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForChillerById(chiller_id),
          })
        );
      }
      return asMcpText(
        toolOk(chiller, [{ collection: "chillers", id: chiller_id }], {
          query_insight: insightForChillerById(chiller_id),
        })
      );
    }
  );

  server.registerTool(
    "getChillerConfiguration",
    {
      description: "Get chiller configuration subset for a unit",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const chiller = await getChillerById(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForChillerById(chiller_id),
          })
        );
      }
      const data = {
        chiller_id: chiller.chiller_id,
        model_family: chiller.model_family,
        model_number: chiller.model_number,
        product_line: chiller.product_line,
        configuration: chiller.configuration,
        current_setpoints: chiller.current_setpoints,
        firmware_version: chiller.firmware_version,
      };
      return asMcpText(
        toolOk(data, [{ collection: "chillers", id: chiller_id }], {
          query_insight: insightForChillerById(chiller_id),
        })
      );
    }
  );

  server.registerTool(
    "getSiteContext",
    {
      description: "Get installation site context for a chiller",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const { chiller, site } = await getSiteContextForChiller(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForSiteContext(chiller_id),
          })
        );
      }
      const refs = [{ collection: "chillers", id: chiller_id }];
      if (site) refs.push({ collection: "sites", id: site.site_id });
      return asMcpText(
        toolOk({ chiller, site }, refs, { query_insight: insightForSiteContext(chiller_id) })
      );
    }
  );

  server.registerTool(
    "getActiveAlarms",
    {
      description: "Get active alarms for a chiller enriched with alarm definitions",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const alarms = await getActiveAlarms(chiller_id);
      return asMcpText(
        toolOk(
          { alarms },
          alarms.map((a) => ({ collection: "alarm_events", id: a.event_id })),
          { query_insight: insightForActiveAlarms(chiller_id) }
        )
      );
    }
  );

  server.registerTool(
    "getAlarmHistory",
    {
      description: "Get alarm history for a chiller within lookback window",
      inputSchema: {
        chiller_id: z.string(),
        lookback_hours: z.number().optional().default(168),
      },
    },
    async ({ chiller_id, lookback_hours }) => {
      const alarms = await getAlarmHistory(chiller_id, lookback_hours);
      return asMcpText(
        toolOk(
          { alarms, lookback_hours },
          alarms.map((a) => ({ collection: "alarm_events", id: a.event_id })),
          { query_insight: insightForAlarmHistory(chiller_id, lookback_hours) }
        )
      );
    }
  );

  server.registerTool(
    "getAlarmDetails",
    {
      description: "Get alarm reference definition by alarm_code",
      inputSchema: { alarm_code: z.string() },
    },
    async ({ alarm_code }) => {
      const def = await getAlarmDefinition(alarm_code);
      if (!def) {
        return asMcpText(
          toolNotFound(`Alarm code ${alarm_code} not found`, {
            query_insight: insightForAlarmDefinition(alarm_code),
          })
        );
      }
      return asMcpText(
        toolOk(def, [{ collection: "alarm_definitions", id: alarm_code }], {
          query_insight: insightForAlarmDefinition(alarm_code),
        })
      );
    }
  );

  server.registerTool(
    "getCurrentDeviceState",
    {
      description: "Get current operating state snapshot for a chiller",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const chiller = await getChillerById(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForChillerById(chiller_id),
          })
        );
      }
      const latest = await getLatestTelemetry(chiller_id);
      return asMcpText(
        toolOk(
          {
            chiller_id,
            operating_status: chiller.operating_status,
            connectivity: chiller.connectivity,
            current_setpoints: chiller.current_setpoints,
            latest_telemetry: latest,
          },
          [{ collection: "chillers", id: chiller_id }],
          { query_insight: insightForLatestTelemetry(chiller_id) }
        )
      );
    }
  );

  server.registerTool(
    "getTelemetry",
    {
      description: "Get telemetry readings for a chiller within a time window",
      inputSchema: {
        chiller_id: z.string(),
        start_time: z.string(),
        end_time: z.string(),
      },
    },
    async ({ chiller_id, start_time, end_time }) => {
      const readings = await getTelemetryWindow(chiller_id, start_time, end_time);
      return asMcpText(
        toolOk(
          { readings, start_time, end_time, count: readings.length },
          readings.map((r) => ({ collection: "telemetry", id: `${chiller_id}:${r.timestamp}` })),
          { query_insight: insightForTelemetryWindow(chiller_id, start_time, end_time) }
        )
      );
    }
  );

  server.registerTool(
    "getServiceHistory",
    {
      description: "Get service ticket history for a chiller",
      inputSchema: {
        chiller_id: z.string(),
        limit: z.number().optional().default(20),
      },
    },
    async ({ chiller_id, limit }) => {
      const tickets = await getServiceHistory(chiller_id, limit);
      return asMcpText(
        toolOk(
          { tickets },
          tickets.map((t) => ({ collection: "service_tickets", id: t.ticket_id })),
          { query_insight: insightForServiceHistory(chiller_id) }
        )
      );
    }
  );

  server.registerTool(
    "getPartsHistory",
    {
      description: "Get aggregated parts replacement history for a chiller",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const parts = await getPartsHistory(chiller_id);
      return asMcpText(
        toolOk({ parts }, [], { query_insight: insightForPartsHistory(chiller_id) })
      );
    }
  );

  server.registerTool(
    "getFaultEvents",
    {
      description: "Get fault events for a chiller (stub until fault_events collection exists)",
      inputSchema: {
        chiller_id: z.string(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
      },
    },
    async () => {
      return asMcpText(
        toolNotConfigured(
          "fault_events collection not yet provisioned. Planned fields: event_id, chiller_id, event_type, severity, timestamp, description",
          { query_insight: insightForNotConfigured("fault_events") }
        )
      );
    }
  );

  const registerKnowledgeTool = (name, type, description) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema: {
          query: z.string(),
          filters: filtersSchema,
        },
      },
      async ({ query, filters }) => asMcpText(await tryKnowledgeSearch(query, type, filters || {}))
    );
  };

  registerKnowledgeTool(
    "searchManuals",
    "manual",
    "Semantic search product manuals (Atlas autoEmbed on knowledge_documents.content)"
  );
  registerKnowledgeTool(
    "searchTroubleshootingGuides",
    "troubleshooting_guide",
    "Semantic search troubleshooting guides"
  );
  registerKnowledgeTool(
    "searchTechnicalBulletins",
    "technical_bulletin",
    "Semantic search technical bulletins"
  );

  server.registerTool(
    "rerankKnowledgeResults",
    {
      description: "Re-rank knowledge search results using alarm and model context",
      inputSchema: {
        results: z.array(z.record(z.unknown())),
        context: contextSchema,
      },
    },
    async ({ results, context }) => {
      const ranked = rerankKnowledgeResults(results, context || {});
      return asMcpText(
        toolOk({ results: ranked }, [], { query_insight: insightForRerank("knowledge") })
      );
    }
  );

  server.registerTool(
    "filterCases",
    {
      description: "Deterministically filter prior service cases",
      inputSchema: {
        product_family: z.string().optional(),
        alarm_category: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional().default(20),
      },
    },
    async ({ product_family, alarm_category, status, limit }) => {
      const cases = await filterCases({
        productFamily: product_family,
        alarmCategory: alarm_category,
        status,
        limit,
      });
      return asMcpText(
        toolOk(
          { cases },
          cases.map((c) => ({ collection: "service_tickets", id: c.ticket_id })),
          {
            query_insight: insightForFilterCases({
              productFamily: product_family,
              alarmCategory: alarm_category,
              status,
            }),
          }
        )
      );
    }
  );

  server.registerTool(
    "searchCaseNotes",
    {
      description: "Hybrid case note search (vector autoEmbed + Atlas Search text)",
      inputSchema: {
        query: z.string(),
        filters: z
          .object({
            status: z.string().optional(),
            chiller_id: z.string().optional(),
            related_alarm_codes: z.array(z.string()).optional(),
          })
          .optional(),
      },
    },
    async ({ query, filters }) => asMcpText(await tryCaseSearch(query, filters || {}))
  );

  server.registerTool(
    "rerankSimilarCases",
    {
      description: "Re-rank case search results using alarm and model context",
      inputSchema: {
        results: z.array(z.record(z.unknown())),
        context: contextSchema,
      },
    },
    async ({ results, context }) => {
      const ranked = rerankSimilarCases(results, context || {});
      return asMcpText(
        toolOk({ results: ranked }, [], { query_insight: insightForRerank("cases") })
      );
    }
  );

  server.registerTool(
    "startTroubleshootingSession",
    {
      description: "Start a troubleshooting session for a chiller",
      inputSchema: {
        chiller_id: z.string(),
        user_id: z.string(),
        problem_context: z.string().optional(),
      },
    },
    async ({ chiller_id, user_id, problem_context }) => {
      const session = await startSession({
        chillerId: chiller_id,
        userId: user_id,
        problemContext: problem_context,
      });
      return asMcpText(
        toolOk(session, [{ collection: "troubleshooting_sessions", id: session.session_id }], {
          query_insight: insightForSessionWrite("troubleshooting_sessions", "insertOne"),
        })
      );
    }
  );

  server.registerTool(
    "storeRecommendationTrace",
    {
      description: "Store recommendation trace with source evidence refs",
      inputSchema: {
        session_id: z.string(),
        source_data_refs: z.array(z.record(z.string())),
        inferred_outputs: z.record(z.unknown()),
      },
    },
    async ({ session_id, source_data_refs, inferred_outputs }) => {
      const trace = await storeRecommendationTrace({
        sessionId: session_id,
        sourceDataRefs: source_data_refs,
        inferredOutputs: inferred_outputs,
      });
      return asMcpText(
        toolOk(trace, [{ collection: "recommendation_traces", id: trace.trace_id }], {
          query_insight: insightForSessionWrite("recommendation_traces", "insertOne"),
        })
      );
    }
  );

  server.registerTool(
    "captureEngineerReaction",
    {
      description: "Capture engineer positive/negative reaction to a recommendation",
      inputSchema: {
        session_id: z.string(),
        signal: z.enum(["positive", "negative"]),
        notes: z.string().optional(),
      },
    },
    async ({ session_id, signal, notes }) => {
      const feedback = await captureEngineerReaction({ sessionId: session_id, signal, notes });
      return asMcpText(
        toolOk(feedback, [{ collection: "engineer_feedback", id: feedback.feedback_id }], {
          query_insight: insightForSessionWrite("engineer_feedback", "insertOne"),
        })
      );
    }
  );

  server.registerTool(
    "captureResolutionOutcome",
    {
      description: "Capture final diagnosis and resolution for a session",
      inputSchema: {
        session_id: z.string(),
        diagnosis: z.string(),
        repair_notes: z.string(),
        resolution: z.string(),
      },
    },
    async ({ session_id, diagnosis, repair_notes, resolution }) => {
      const feedback = await captureResolutionOutcome({
        sessionId: session_id,
        diagnosis,
        repairNotes: repair_notes,
        resolution,
      });
      return asMcpText(
        toolOk(feedback, [{ collection: "engineer_feedback", id: feedback.feedback_id }], {
          query_insight: insightForSessionWrite("engineer_feedback", "insertOne"),
        })
      );
    }
  );

  return server;
}
