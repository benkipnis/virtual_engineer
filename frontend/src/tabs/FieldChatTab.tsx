import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PatternBadge } from "../components/PatternBadge";
import { QueryInspector } from "../components/QueryInspector";
import { useChat } from "../context/ChatContext";
import type { ToolEvent } from "../types";

function groupByRound(events: ToolEvent[]): Map<number, ToolEvent[]> {
  const rounds = new Map<number, ToolEvent[]>();
  for (const ev of events) {
    const r = ev.round ?? 0;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(ev);
  }
  return rounds;
}

export function FieldChatTab() {
  const {
    messages,
    toolEvents,
    isStreaming,
    selectedChillerId,
    sendMessage,
    sendFeedback,
    sessionId,
  } = useChat();
  const [input, setInput] = useState("");
  const [xrayOpen, setXrayOpen] = useState(false);

  const activeTools = toolEvents.filter((e) => !e.result);
  const latestPattern = toolEvents.filter((e) => e.query_insight).at(-1)?.query_insight?.pattern;

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim(), selectedChillerId);
    setInput("");
  };

  const rounds = groupByRound(toolEvents);
  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);

  return (
    <>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            {selectedChillerId && (
              <code style={{ fontSize: "0.8rem", color: "var(--mongo-green-dark)" }}>
                {selectedChillerId}
              </code>
            )}
          </div>
          <button className="btn-secondary" onClick={() => setXrayOpen(true)}>
            X-ray Mode
          </button>
        </div>

        <div className="activity-strip">
          {isStreaming && (
            <span className="pattern-badge pattern-vector_search" style={{ animation: "pulse-border 1s infinite" }}>
              Agent working…
            </span>
          )}
          {activeTools.map((e) => (
            <span key={e.id} className="pattern-badge pattern-exact_find">
              {e.tool}…
            </span>
          ))}
          {!isStreaming && latestPattern && (
            <PatternBadge pattern={latestPattern} />
          )}
        </div>

        <div className="card" style={{ minHeight: "400px", marginBottom: "1rem" }}>
          {messages.length === 0 && (
            <div className="empty-zone" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              Describe the chiller issue you're troubleshooting on site.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "message-user" : "message-assistant"}>
              {m.role === "assistant" ? (
                <ReactMarkdown>{m.content}</ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          ))}
        </div>

        {sessionId && messages.some((m) => m.role === "assistant") && (
          <div className="feedback-row">
            <span style={{ fontSize: "0.85rem", color: "var(--mongo-gray)" }}>Was this helpful?</span>
            <button className="feedback-btn" onClick={() => sendFeedback("positive")}>
              👍 Yes
            </button>
            <button className="feedback-btn" onClick={() => sendFeedback("negative")}>
              👎 No
            </button>
          </div>
        )}

        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. CH-ATL-003 tripped on A1.01 again…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isStreaming || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {xrayOpen && (
        <>
          <button className="xray-close" onClick={() => setXrayOpen(false)}>
            Close X-ray
          </button>
          <div className="xray-overlay">
            <h2>MongoDB Retrieval X-ray</h2>
            <p style={{ color: "#aaa", marginBottom: "1.5rem" }}>
              Live tool calls, query patterns, and Atlas services invoked during this session.
            </p>
            {toolEvents.length === 0 && <p>No tool calls yet.</p>}
            {sortedRounds.map(([round, events], roundIdx) => (
              <div key={round}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--mongo-green)",
                    marginBottom: "0.75rem",
                    marginTop: roundIdx > 0 ? "1.5rem" : 0,
                  }}
                >
                  Round {round}
                </div>
                {events.map((e) => (
                  <div key={e.id} className="xray-timeline-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{e.tool}</strong>
                      {e.latency_ms != null && (
                        <span style={{ fontSize: "0.8rem", color: "var(--mongo-green)" }}>
                          {e.latency_ms}ms
                        </span>
                      )}
                    </div>
                    {(e.result as { degraded?: boolean } | undefined)?.degraded && (
                      <div style={{ color: "#ffb74d", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                        ⚠ Degraded: {(e.result as { message?: string }).message}
                      </div>
                    )}
                    <div style={{ marginTop: "0.5rem" }}>
                      <QueryInspector insight={e.query_insight} result={e.result} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
