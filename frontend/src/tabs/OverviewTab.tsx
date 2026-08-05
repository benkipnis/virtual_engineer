import { SCENARIOS } from "../types";
import { ScenarioPicker } from "../components/ScenarioPicker";
import { useChat } from "../context/ChatContext";

interface Props {
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ onNavigate }: Props) {
  const { setSelectedChillerId, sendMessage } = useChat();

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", color: "var(--mongo-green-dark)" }}>
          Virtual Engineer
        </h2>
        <p style={{ margin: 0, lineHeight: 1.6, maxWidth: "720px" }}>
          AI-assisted troubleshooting for field engineers. The agent establishes factual grounding
          through deterministic MongoDB lookups, then expands into semantic knowledge and case
          retrieval — all visible in real time.
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3>Architecture — Two-Layer Retrieval</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: "1rem",
            alignItems: "center",
            marginTop: "0.75rem",
          }}
        >
          <div style={{ background: "#e8faf0", padding: "1rem", borderRadius: "6px" }}>
            <strong>Layer 1 — Deterministic</strong>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              <li>Asset resolution (exact find)</li>
              <li>Active alarms ($lookup joins)</li>
              <li>Telemetry windows (time series)</li>
              <li>Service history</li>
            </ul>
          </div>
          <span style={{ fontSize: "1.5rem", color: "var(--mongo-green-dark)" }}>→</span>
          <div style={{ background: "#fff8e1", padding: "1rem", borderRadius: "6px" }}>
            <strong>Layer 2 — Probabilistic</strong>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              <li>Vector search (manuals, guides)</li>
              <li>Hybrid search (case notes)</li>
              <li>Evidence-based recommendations</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3>Atlas Services</h3>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {["Atlas Database", "Vector Search (autoEmbed)", "Atlas Search", "Time Series"].map(
            (s) => (
              <span
                key={s}
                className="pattern-badge pattern-vector_search"
                style={{ background: "#e8faf0", color: "var(--mongo-green-dark)" }}
              >
                {s}
              </span>
            )
          )}
        </div>
      </div>

      <h3 style={{ marginBottom: "0.75rem" }}>Demo Scenarios</h3>
      <p style={{ color: "var(--mongo-gray)", fontSize: "0.9rem", marginTop: 0 }}>
        Select a scenario and starter prompt. The LLM agent chooses tools dynamically — no scripted
        sequences. Switch to <strong>Evidence Board</strong> (technical) or{" "}
        <strong>Field Chat</strong> (business) to run the demo.
      </p>
      <ScenarioPicker
        scenarios={SCENARIOS}
        selectedId={null}
        onSelect={(s) => setSelectedChillerId(s.chillerId)}
        onPrompt={(prompt, chillerId) => {
          setSelectedChillerId(chillerId);
          sendMessage(prompt, chillerId);
          onNavigate("evidence");
        }}
      />
    </div>
  );
}
