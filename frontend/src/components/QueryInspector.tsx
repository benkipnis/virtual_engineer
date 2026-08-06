import type { QueryInsight } from "../types";
import { PatternBadge } from "./PatternBadge";

interface Props {
  insight: QueryInsight | null | undefined;
  title?: string;
}

export function QueryInspector({ insight, title }: Props) {
  if (!insight) {
    return <div className="empty-zone">No query metadata available</div>;
  }

  return (
    <div>
      {title && <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>{title}</h4>}
      <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <PatternBadge pattern={insight.pattern} />
        <span style={{ fontSize: "0.8rem", color: "var(--mongo-gray)" }}>
          {insight.collection}
          {insight.index ? ` · ${insight.index}` : ""}
        </span>
      </div>
      {insight.rank_fusion_legs && insight.rank_fusion_legs.length > 0 && (
        <div className="rank-fusion-legs">
          {insight.rank_fusion_legs.map((leg) => (
            <span key={leg.pipeline} className="rank-fusion-leg">
              {leg.pipeline}: rank {leg.rank ?? "n/a"} (weight {leg.weight})
            </span>
          ))}
        </div>
      )}
      <pre className="query-inspector">{insight.query_excerpt}</pre>
    </div>
  );
}
