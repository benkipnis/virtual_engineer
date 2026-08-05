export function toolOk(data, evidenceRefs = [], extra = {}) {
  const { query_insight, ...rest } = extra;
  return {
    status: "ok",
    data,
    evidence_refs: evidenceRefs,
    degraded: false,
    ...(query_insight ? { query_insight } : {}),
    ...rest,
  };
}

export function toolNotFound(message, extra = {}) {
  const { query_insight, ...rest } = extra;
  return {
    status: "not_found",
    data: null,
    evidence_refs: [],
    degraded: false,
    message,
    ...(query_insight ? { query_insight } : {}),
    ...rest,
  };
}

export function toolNotConfigured(message, extra = {}) {
  const { query_insight, ...rest } = extra;
  return {
    status: "not_configured",
    data: null,
    evidence_refs: [],
    degraded: false,
    message,
    ...(query_insight ? { query_insight } : {}),
    ...rest,
  };
}

export function toolError(message, extra = {}) {
  return {
    status: "error",
    data: null,
    evidence_refs: [],
    degraded: false,
    message,
    ...extra,
  };
}

export function toolDegraded(data, message, evidenceRefs = [], extra = {}) {
  const { query_insight, ...rest } = extra;
  return {
    status: "ok",
    data,
    evidence_refs: evidenceRefs,
    degraded: true,
    message,
    ...(query_insight ? { query_insight } : {}),
    ...rest,
  };
}

export function asMcpText(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
