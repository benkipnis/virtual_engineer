export type QueryPattern =
  | "exact_find"
  | "aggregation_lookup"
  | "time_series_window"
  | "vector_search"
  | "atlas_search"
  | "hybrid_search"
  | "in_memory"
  | "write"
  | "not_configured";

export interface QueryInsight {
  pattern: QueryPattern;
  collection: string;
  index?: string;
  query_excerpt: string;
}

export interface ToolEvent {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  latency_ms?: number;
  query_insight?: QueryInsight | null;
  timestamp: number;
}

export interface EvidenceZone {
  asset?: unknown;
  alarms?: unknown;
  telemetry?: unknown;
  service_history?: unknown;
  knowledge?: unknown;
  similar_cases?: unknown;
  recommendation?: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Scenario {
  chillerId: string;
  label: string;
  alarm: string;
  description: string;
  prompts: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    chillerId: "CH-ATL-003",
    label: "Hero — Motor Temperature",
    alarm: "A1.01",
    description: "30XA at Piedmont Hospital — repeat compressor motor temp fault with prior PTC replacement.",
    prompts: [
      "I'm on site at CH-ATL-003. The unit tripped on A1.01 again. What should I check first?",
      "Show me telemetry trends and prior service history for this chiller.",
    ],
  },
  {
    chillerId: "CH-DAL-002",
    label: "High Condenser Pressure",
    alarm: "207",
    description: "19XR water-cooled unit — alarm 207, cooling tower fan issue suspected.",
    prompts: [
      "CH-DAL-002 tripped on alarm 207. Data hall temps are rising. Help me troubleshoot.",
      "Have we seen this condenser pressure issue on this unit before?",
    ],
  },
  {
    chillerId: "CH-PHX-005",
    label: "Communication Fault",
    alarm: "Co.A1",
    description: "30RB at semiconductor fab — Co.A1 LEN bus communication loss.",
    prompts: [
      "CH-PHX-005 is offline with Co.A1 communication fault. What's the likely cause?",
      "Find similar communication fault cases and relevant technical bulletins.",
    ],
  },
  {
    chillerId: "CH-ATL-001",
    label: "Stable Unit (PM)",
    alarm: "—",
    description: "Healthy 30RB — preventive maintenance history, no active faults.",
    prompts: [
      "Check the status of CH-ATL-001. Any active alarms or recent issues?",
      "Summarize service history and current operating state for CH-ATL-001.",
    ],
  },
];
