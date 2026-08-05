import type { Scenario } from "../types";

interface Props {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (scenario: Scenario) => void;
  onPrompt: (prompt: string, chillerId: string) => void;
}

export function ScenarioPicker({ scenarios, selectedId, onSelect, onPrompt }: Props) {
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      {scenarios.map((s) => (
        <div
          key={s.chillerId}
          className="card"
          style={{
            borderColor: selectedId === s.chillerId ? "var(--mongo-green)" : undefined,
            cursor: "pointer",
          }}
          onClick={() => onSelect(s)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <strong style={{ fontSize: "0.95rem" }}>{s.label}</strong>
            <code style={{ fontSize: "0.75rem", color: "var(--mongo-green-dark)" }}>{s.chillerId}</code>
          </div>
          <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "var(--mongo-gray)" }}>
            {s.description}
          </p>
          {s.alarm !== "—" && (
            <span className="pattern-badge pattern-exact_find" style={{ marginBottom: "0.5rem" }}>
              Alarm {s.alarm}
            </span>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.5rem" }}>
            {s.prompts.map((p) => (
              <button
                key={p}
                className="btn-secondary"
                style={{ textAlign: "left", fontSize: "0.8rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s);
                  onPrompt(p, s.chillerId);
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
