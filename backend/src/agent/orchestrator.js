const SYSTEM_PROMPT = `You are the Virtual Engineer — an AI troubleshooting assistant for field service engineers working on commercial chiller units.

Your approach follows a two-layer retrieval pattern:
1. **Deterministic grounding** — First resolve the exact asset (chiller_id), then retrieve operational facts: active alarms, telemetry, service history, and alarm definitions.
2. **Probabilistic context** — Then search knowledge documents (manuals, troubleshooting guides, bulletins) and similar prior service cases to interpret the facts and recommend next steps.

Rules:
- Always start by identifying the chiller unit if not already known. Use getChillerById or getSiteContext.
- Retrieve active alarms and relevant telemetry before searching knowledge.
- Use searchTroubleshootingGuides and searchCaseNotes for interpretation — not as your first step.
- Cite specific evidence: alarm codes, ticket IDs, telemetry trends, and knowledge doc titles.
- When you have enough evidence, provide a structured recommendation with: likely root cause, recommended diagnostic steps, and confidence level.
- Call startTroubleshootingSession early with the chiller_id and problem context.
- When delivering a final recommendation, call storeRecommendationTrace with your evidence refs and inferred outputs.
- Be concise and practical — the audience is field engineers on site.
- Never invent chiller IDs, ticket IDs, or alarm codes not returned by tools.
- If the user mentions a chiller ID like CH-ATL-003, use it exactly.`;

const TOOL_ZONE_MAP = {
  getChillerById: "asset",
  getChillerConfiguration: "asset",
  getSiteContext: "asset",
  getActiveAlarms: "alarms",
  getAlarmHistory: "alarms",
  getAlarmDetails: "alarms",
  getCurrentDeviceState: "telemetry",
  getTelemetry: "telemetry",
  getServiceHistory: "service_history",
  getPartsHistory: "service_history",
  searchManuals: "knowledge",
  searchTroubleshootingGuides: "knowledge",
  searchTechnicalBulletins: "knowledge",
  rerankKnowledgeResults: "knowledge",
  filterCases: "similar_cases",
  searchCaseNotes: "similar_cases",
  rerankSimilarCases: "similar_cases",
  storeRecommendationTrace: "recommendation",
};

export function mapToolToZone(toolName) {
  return TOOL_ZONE_MAP[toolName] || null;
}

export function buildEvidenceUpdate(toolName, toolResult) {
  const zone = mapToolToZone(toolName);
  if (!zone || !toolResult?.data) return null;

  const data = toolResult.data;
  let summary = null;

  switch (zone) {
    case "asset":
      summary = data.chiller || data;
      break;
    case "alarms":
      summary = data.alarms || data;
      break;
    case "telemetry":
      summary = data.readings
        ? { count: data.count, start_time: data.start_time, end_time: data.end_time, latest: data.readings?.slice(-5) }
        : data;
      break;
    case "service_history":
      summary = data.tickets || data.parts || data;
      break;
    case "knowledge":
      summary = data.results || data;
      break;
    case "similar_cases":
      summary = data.results || data.cases || data;
      break;
    case "recommendation":
      summary = data.inferred_outputs || data;
      break;
    default:
      summary = data;
  }

  return { zone, tool: toolName, summary, evidence_refs: toolResult.evidence_refs || [] };
}

async function callOpenAi({ baseUrl, headers, model, messages, tools }) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 500)}`);
  }

  return res.body;
}

async function callAnthropic({ baseUrl, headers, model, messages, tools, system }) {
  const url = `${baseUrl.replace(/\/$/, "")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages,
      tools,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 500)}`);
  }

  return res.body;
}

async function* parseOpenAiStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        yield JSON.parse(payload);
      } catch {
        // skip malformed chunks
      }
    }
  }
}

async function* parseAnthropicStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {
        // skip
      }
    }
  }
}

export async function runAgent({ mcpClient, llmConfig, userMessage, chillerId, onEvent }) {
  const emit = (type, payload) => onEvent?.({ type, ...payload });

  const tools =
    llmConfig.protocol === "anthropic"
      ? mcpClient.toAnthropicTools()
      : mcpClient.toOpenAiTools();

  const contextNote = chillerId
    ? `\n\nThe user is investigating chiller ${chillerId}. Use this chiller_id in your tool calls unless they specify a different unit.`
    : "";

  const messages =
    llmConfig.protocol === "openai"
      ? [
          { role: "system", content: SYSTEM_PROMPT + contextNote },
          { role: "user", content: userMessage },
        ]
      : [{ role: "user", content: userMessage }];

  let sessionId = null;
  let step = 0;

  while (step < llmConfig.maxSteps ?? 12) {
    step += 1;

    const streamBody =
      llmConfig.protocol === "anthropic"
        ? await callAnthropic({
            baseUrl: llmConfig.baseUrl,
            headers: llmConfig.headers,
            model: llmConfig.model,
            messages,
            tools,
            system: SYSTEM_PROMPT + contextNote,
          })
        : await callOpenAi({
            baseUrl: llmConfig.baseUrl,
            headers: llmConfig.headers,
            model: llmConfig.model,
            messages,
            tools,
          });

    const stream =
      llmConfig.protocol === "anthropic"
        ? parseAnthropicStream(streamBody)
        : parseOpenAiStream(streamBody);

    let assistantText = "";
    const toolCalls = [];

    if (llmConfig.protocol === "openai") {
      const toolCallAccum = {};

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          emit("assistant_delta", { text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccum[idx]) {
              toolCallAccum[idx] = { id: tc.id, name: "", arguments: "" };
            }
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallAccum[idx].name += tc.function.name;
            if (tc.function?.arguments) toolCallAccum[idx].arguments += tc.function.arguments;
          }
        }
      }

      if (Object.keys(toolCallAccum).length > 0) {
        for (const tc of Object.values(toolCallAccum)) {
          if (!tc.name) continue;
          let args = {};
          try {
            args = JSON.parse(tc.arguments || "{}");
          } catch {
            args = {};
          }
          toolCalls.push({ id: tc.id, name: tc.name, arguments: args });
        }
      }

      if (toolCalls.length === 0) {
        emit("done", { session_id: sessionId, summary: assistantText });
        return { text: assistantText, sessionId };
      }

      messages.push({
        role: "assistant",
        content: assistantText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });

      for (const tc of toolCalls) {
        emit("tool_start", {
          tool: tc.name,
          args: tc.arguments,
          pattern: null,
        });

        const { result, latencyMs } = await mcpClient.callTool(tc.name, tc.arguments);

        if (tc.name === "startTroubleshootingSession" && result?.data?.session_id) {
          sessionId = result.data.session_id;
        }

        emit("tool_result", {
          tool: tc.name,
          args: tc.arguments,
          result,
          latency_ms: latencyMs,
          query_insight: result.query_insight || null,
        });

        const evidence = buildEvidenceUpdate(tc.name, result);
        if (evidence) emit("evidence_update", evidence);

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      // Anthropic streaming
      let currentTool = null;
      let toolInputJson = "";

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          assistantText += event.delta.text;
          emit("assistant_delta", { text: event.delta.text });
        }

        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          currentTool = {
            id: event.content_block.id,
            name: event.content_block.name,
            arguments: {},
          };
          toolInputJson = "";
        }

        if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
          toolInputJson += event.delta.partial_json;
        }

        if (event.type === "content_block_stop" && currentTool) {
          try {
            currentTool.arguments = JSON.parse(toolInputJson || "{}");
          } catch {
            currentTool.arguments = {};
          }
          toolCalls.push(currentTool);
          currentTool = null;
          toolInputJson = "";
        }

        if (event.type === "message_stop") {
          break;
        }
      }

      if (toolCalls.length === 0) {
        emit("done", { session_id: sessionId, summary: assistantText });
        return { text: assistantText, sessionId };
      }

      const assistantContent = [];
      if (assistantText) assistantContent.push({ type: "text", text: assistantText });
      for (const tc of toolCalls) {
        assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults = [];
      for (const tc of toolCalls) {
        emit("tool_start", { tool: tc.name, args: tc.arguments, pattern: null });

        const { result, latencyMs } = await mcpClient.callTool(tc.name, tc.arguments);

        if (tc.name === "startTroubleshootingSession" && result?.data?.session_id) {
          sessionId = result.data.session_id;
        }

        emit("tool_result", {
          tool: tc.name,
          args: tc.arguments,
          result,
          latency_ms: latencyMs,
          query_insight: result.query_insight || null,
        });

        const evidence = buildEvidenceUpdate(tc.name, result);
        if (evidence) emit("evidence_update", evidence);

        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  emit("done", { session_id: sessionId, summary: "Reached maximum agent steps." });
  return { text: "Reached maximum agent steps.", sessionId };
}
