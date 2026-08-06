const nodeBase: React.CSSProperties = {
  borderRadius: "8px",
  padding: "8px 14px",
  fontSize: "0.8rem",
  lineHeight: 1.35,
  textAlign: "center",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  flex: "1 1 0",
  minWidth: 0,
};

const greenNode: React.CSSProperties = {
  ...nodeBase,
  background: "#e8faf0",
  border: "1.5px solid #00684a",
  color: "#023430",
};

const grayNode: React.CSSProperties = {
  ...nodeBase,
  background: "#eceff1",
  border: "1.5px solid #90a4ae",
  color: "#37474f",
};

const amberNode: React.CSSProperties = {
  ...nodeBase,
  background: "#fff8e1",
  border: "1.5px solid #f57f17",
  color: "#5d4037",
};

const orangeNode: React.CSSProperties = {
  ...nodeBase,
  background: "#fff3e0",
  border: "1.5px solid #e65100",
  color: "#4e2600",
};

const redNode: React.CSSProperties = {
  ...nodeBase,
  background: "#fce4ec",
  border: "1.5px solid #c62828",
  color: "#4a0010",
};

const lightGreenNode: React.CSSProperties = {
  ...nodeBase,
  background: "#e8f5e9",
  border: "1.5px solid #2e7d32",
  color: "#1b5e20",
};

function Node({ style, main, sub }: { style: React.CSSProperties; main: string; sub?: string }) {
  return (
    <div style={style}>
      <strong style={{ fontSize: "0.82rem" }}>{main}</strong>
      {sub && <div style={{ fontSize: "0.68rem", opacity: 0.75, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Arrow({ label, color = "#90a4ae", bidir = false }: { label?: string; color?: string; bidir?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, flexShrink: 0, padding: "0 4px" }}>
      {label && <span style={{ fontSize: "0.6rem", color, whiteSpace: "nowrap" }}>{label}</span>}
      <span style={{ fontSize: "1rem", color }}>{bidir ? "⇄" : "→"}</span>
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* Row 1: request pipeline */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "1rem" }}>
        <Node style={grayNode} main="Field Engineer" sub="on-site" />
        <Arrow label="question" color="#90a4ae" />
        <Node style={greenNode} main="Demo UI" sub="React / Vite" />
        <Arrow label="SSE / REST" color="#00684a" bidir />
        <Node style={greenNode} main="Express API" sub="Node.js · :3100" />
        <Arrow label="chat prompt" color="#f57f17" />
        <Node style={amberNode} main="LLM Agent" sub="OpenAI / Anthropic / Grove" />
        <Arrow label="tool calls" color="#00684a" bidir />
        <Node style={greenNode} main="MCP Server" sub="24 tools" />
      </div>

      {/* Connector: MCP → Atlas */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: "calc(0% + 0px)", marginBottom: "0.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "calc(100% / 9)", minWidth: 80 }}>
          <span style={{ fontSize: "0.6rem", color: "#00684a" }}>driver / pipeline</span>
          <span style={{ color: "#00684a", fontSize: "1rem" }}>↓</span>
        </div>
      </div>

      {/* Row 2: Atlas cluster */}
      <div
        style={{
          border: "1.5px dashed #00ed64",
          borderRadius: "12px",
          padding: "12px 14px 10px",
          background: "rgba(0, 237, 100, 0.04)",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#00684a",
            marginBottom: "8px",
          }}
        >
          MongoDB Atlas Cluster
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Node style={greenNode} main="Atlas Database" sub="chillers · alarms · tickets · sessions" />
          <Node style={orangeNode} main="Vector Search" sub="autoEmbed · voyage-4" />
          <Node style={redNode} main="Atlas Search + $rankFusion" sub="hybrid search" />
          <Node style={lightGreenNode} main="Time Series" sub="telemetry · hourly" />
        </div>
      </div>
    </div>
  );
}
