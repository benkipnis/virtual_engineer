import type { QueryInsight } from "../types";
import { PatternBadge } from "./PatternBadge";

interface Props {
  insight: QueryInsight | null | undefined;
  title?: string;
  result?: Record<string, unknown>;
}

export function QueryInspector({ insight, title, result }: Props) {
  if (!insight) {
    return <div className="empty-zone">Select a tool call above to inspect its query and result</div>;
  }

  const resultText = result != null
    ? JSON.stringify(result, null, 2)
    : null;

  return (
    <div>
      {/* Header row: title, pattern badge, collection */}
      <div className="query-inspector-header">
        {title && <span className="query-inspector-title">{title}</span>}
        <PatternBadge pattern={insight.pattern} />
        <span className="query-inspector-meta">
          {insight.collection}
          {insight.index ? ` · ${insight.index}` : ""}
        </span>
      </div>

      {insight.rank_fusion_legs && insight.rank_fusion_legs.length > 0 && (
        <div className="rank-fusion-legs" style={{ marginBottom: "0.5rem" }}>
          {insight.rank_fusion_legs.map((leg) => (
            <span key={leg.pipeline} className="rank-fusion-leg">
              {leg.pipeline}: rank {leg.rank ?? "n/a"} (weight {leg.weight})
            </span>
          ))}
        </div>
      )}

      {/* Two-column layout: query | result */}
      <div className="query-inspector-columns">
        <div className="query-inspector-col">
          <div className="query-inspector-col-label">Query sent to Atlas</div>
          <pre className="query-inspector">{insight.query_excerpt}</pre>
        </div>
        {resultText != null && (
          <div className="query-inspector-col">
            <div className="query-inspector-col-label">Result</div>
            <pre className="query-result-inspector">{resultText}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
