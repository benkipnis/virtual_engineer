import { useState } from "react";
import { PatternBadge } from "../components/PatternBadge";
import { QueryInspector } from "../components/QueryInspector";
import { AgentFlowTimeline } from "../components/AgentFlowTimeline";
import { useChat, usePatternSummary } from "../context/ChatContext";
import ReactMarkdown from "react-markdown";

type RecommendationData = Record<string, unknown>;

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function RecommendationValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ol style={{ margin: "0.25rem 0 0", paddingLeft: "1.4rem" }}>
        {value.map((item, i) => (
          <li key={i} style={{ marginBottom: "0.3rem", fontSize: "0.85rem", lineHeight: 1.5 }}>
            {String(item)}
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object" && value !== null) {
    return <pre style={{ fontSize: "0.78rem", margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(value, null, 2)}</pre>;
  }
  return <span style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>{String(value)}</span>;
}

export function EvidenceBoardTab() {
  const {
    messages,
    evidence,
    toolEvents,
    selectedInsight,
    isStreaming,
    selectedChillerId,
    sendMessage,
    setSelectedInsight,
  } = useChat();
  const patternSummary = usePatternSummary();
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim(), selectedChillerId);
    setInput("");
  };

  const recommendation = evidence.recommendation as RecommendationData | null | undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 1. Chat — full width across the top */}
      <div className="card">
        <h3>Chat</h3>
        {selectedChillerId && (
          <code style={{ fontSize: "0.75rem", color: "var(--mongo-green-dark)" }}>
            {selectedChillerId}
          </code>
        )}
        <div style={{ maxHeight: "280px", overflowY: "auto", marginTop: "0.5rem" }}>
          {messages.length === 0 && (
            <div className="empty-zone">Ask a troubleshooting question…</div>
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
        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the issue…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <button
          className="btn-primary"
          style={{ width: "100%", marginTop: "0.5rem" }}
          onClick={handleSubmit}
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? "Retrieving…" : "Send"}
        </button>
      </div>

      {/* 2. Agent Reasoning Flow with Patterns Used at bottom */}
      <div className="card">
        <h3>Agent Reasoning Flow</h3>
        <AgentFlowTimeline
          toolEvents={toolEvents}
          selectedInsight={selectedInsight}
          onSelect={setSelectedInsight}
        />
        {patternSummary.length > 0 && (
          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--mongo-gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Patterns Used
            </div>
            <div className="pattern-summary">
              {patternSummary.map(([p, count]) => (
                <span key={p} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <PatternBadge pattern={p} />
                  <span style={{ fontSize: "0.8rem" }}>×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Query Inspector */}
      <div className="card">
        <h3>Query Inspector{selectedInsight ? ` — ${selectedInsight.tool}` : ""}</h3>
        <QueryInspector
          insight={selectedInsight?.query_insight}
          result={selectedInsight?.result}
        />
      </div>

      {/* 4. Recommendation — pretty printed */}
      {recommendation && typeof recommendation === "object" && Object.keys(recommendation).length > 0 && (
        <div className="card">
          <h3>Recommendation</h3>
          <div
            style={{
              padding: "1rem",
              background: "var(--surface-alt, #f8fdf9)",
              border: "1px solid var(--mongo-green-dark, #00684a)",
              borderRadius: "6px",
            }}
          >
            {Object.entries(recommendation).map(([key, value]) => (
              <div key={key} style={{ marginBottom: "0.9rem" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--mongo-green-dark)",
                    marginBottom: "0.3rem",
                  }}
                >
                  {formatKey(key)}
                </div>
                <RecommendationValue value={value} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
