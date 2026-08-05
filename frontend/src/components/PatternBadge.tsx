import type { QueryPattern } from "../types";

const LABELS: Record<QueryPattern, string> = {
  exact_find: "Exact Find",
  aggregation_lookup: "$lookup Join",
  time_series_window: "Time Series",
  vector_search: "Vector Search",
  atlas_search: "Atlas Search",
  hybrid_search: "Hybrid Search",
  in_memory: "In-Memory",
  write: "Write",
  not_configured: "Not Configured",
};

interface Props {
  pattern: QueryPattern;
}

export function PatternBadge({ pattern }: Props) {
  return (
    <span className={`pattern-badge pattern-${pattern}`}>
      {LABELS[pattern] || pattern}
    </span>
  );
}

export function patternLabel(pattern: QueryPattern): string {
  return LABELS[pattern] || pattern;
}
