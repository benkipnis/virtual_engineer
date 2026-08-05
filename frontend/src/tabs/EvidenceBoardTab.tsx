import { useState } from "react";
import { EvidenceCard } from "../components/EvidenceCard";
import { PatternBadge } from "../components/PatternBadge";
import { QueryInspector } from "../components/QueryInspector";
import { useChat, usePatternSummary } from "../context/ChatContext";

export function EvidenceBoardTab() {
  const {
    messages,
    evidence,
    toolEvents,
    activeZone,
    selectedInsight,
    isStreaming,
    selectedChillerId,
    sendMessage,
    setSelectedInsight,
  } = useChat();
  const patternSummary = usePatternSummary();
  const [input, setInput] = useState("");

  const uniqueZones = [
    { key: "asset" as const, label: "Asset" },
    { key: "alarms" as const, label: "Active Alarms" },
    { key: "telemetry" as const, label: "Telemetry" },
    { key: "service_history" as const, label: "Service History" },
    { key: "knowledge" as const, label: "Knowledge Docs" },
    { key: "similar_cases" as const, label: "Similar Cases" },
    { key: "recommendation" as const, label: "Recommendation" },
  ];

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim(), selectedChillerId);
    setInput("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem" }}>
      <div>
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>Chat</h3>
          {selectedChillerId && (
            <code style={{ fontSize: "0.75rem", color: "var(--mongo-green-dark)" }}>
              {selectedChillerId}
            </code>
          )}
          <div style={{ maxHeight: "320px", overflowY: "auto", marginTop: "0.5rem" }}>
            {messages.length === 0 && (
              <div className="empty-zone">Ask a troubleshooting question…</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "message-user" : "message-assistant"}>
                {m.content}
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

        {patternSummary.length > 0 && (
          <div className="card">
            <h3>Patterns Used</h3>
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

      <div>
        <div className="evidence-grid" style={{ marginBottom: "1rem" }}>
          {uniqueZones.map((z) => (
            <div
              key={z.key}
              className={`card ${activeZone === z.key ? "zone-active" : ""} ${
                z.key === "recommendation" ? "span-3" : z.key === "service_history" || z.key === "similar_cases" ? "span-2" : ""
              }`}
              style={{ gridColumn: z.key === "recommendation" ? "span 3" : z.key === "service_history" || z.key === "similar_cases" ? "span 2" : undefined }}
            >
              <h3>{z.label}</h3>
              <EvidenceCard data={evidence[z.key]} compact={z.key !== "recommendation"} />
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Query Inspector</h3>
          {toolEvents.length > 0 && (
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {toolEvents
                .filter((e) => e.query_insight)
                .map((e) => (
                  <button
                    key={e.id}
                    className={`btn-secondary ${selectedInsight?.id === e.id ? "active" : ""}`}
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => setSelectedInsight(e)}
                  >
                    {e.tool}
                    {e.latency_ms != null ? ` (${e.latency_ms}ms)` : ""}
                  </button>
                ))}
            </div>
          )}
          <QueryInspector
            insight={selectedInsight?.query_insight}
            title={selectedInsight ? `${selectedInsight.tool}` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
