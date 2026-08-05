interface Props {
  data: unknown;
  compact?: boolean;
}

export function EvidenceCard({ data, compact }: Props) {
  if (data == null) {
    return <div className="empty-zone">Waiting for retrieval…</div>;
  }

  const text = typeof data === "string" ? data : JSON.stringify(data, null, compact ? 0 : 2);

  return (
    <pre
      style={{
        margin: 0,
        fontSize: compact ? "0.75rem" : "0.8rem",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: compact ? "120px" : "200px",
        overflow: "auto",
        fontFamily: "inherit",
        lineHeight: 1.45,
      }}
    >
      {text}
    </pre>
  );
}
