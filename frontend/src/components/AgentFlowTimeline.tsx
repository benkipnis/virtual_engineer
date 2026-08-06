import type { ToolEvent } from "../types";
import { PatternBadge } from "./PatternBadge";

interface Props {
  toolEvents: ToolEvent[];
  selectedInsight: ToolEvent | null;
  onSelect: (event: ToolEvent) => void;
}

function groupByRound(events: ToolEvent[]): Map<number, ToolEvent[]> {
  const rounds = new Map<number, ToolEvent[]>();
  for (const ev of events) {
    const r = ev.round ?? 0;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(ev);
  }
  return rounds;
}

export function AgentFlowTimeline({ toolEvents, selectedInsight, onSelect }: Props) {
  if (toolEvents.length === 0) {
    return (
      <div className="agent-flow-empty">
        Agent tool calls will appear here as the agent works…
      </div>
    );
  }

  const rounds = groupByRound(toolEvents);
  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="agent-flow-timeline">
      {sortedRounds.map(([round, events], roundIdx) => (
        <div key={round}>
          <div className="agent-flow-round-label">Round {round}</div>
          <div className="agent-flow-row">
            {events.map((ev) => {
              const inFlight = !ev.result;
              const isDegraded = (ev.result as { degraded?: boolean } | undefined)?.degraded;
              const isSelected = selectedInsight?.id === ev.id;

              return (
                <button
                  key={ev.id}
                  className={`agent-flow-card${isSelected ? " selected" : ""}${inFlight ? " in-flight" : ""}${isDegraded ? " degraded" : ""}`}
                  onClick={() => onSelect(ev)}
                  title={ev.tool}
                >
                  <span className="agent-flow-tool-name">{ev.tool}</span>
                  {ev.query_insight && (
                    <PatternBadge pattern={ev.query_insight.pattern} />
                  )}
                  <span className="agent-flow-latency">
                    {inFlight ? (
                      <span className="agent-flow-spinner" />
                    ) : isDegraded ? (
                      <span className="agent-flow-degraded-badge">degraded</span>
                    ) : ev.latency_ms != null ? (
                      `${ev.latency_ms}ms`
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          {roundIdx < sortedRounds.length - 1 && (
            <div className="agent-flow-arrow">↓ LLM decides next steps</div>
          )}
        </div>
      ))}
    </div>
  );
}
