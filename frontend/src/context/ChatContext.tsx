import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ChatMessage,
  EvidenceZone,
  QueryPattern,
  ToolEvent,
} from "../types";

interface ChatContextValue {
  messages: ChatMessage[];
  evidence: EvidenceZone;
  toolEvents: ToolEvent[];
  activeZone: string | null;
  selectedInsight: ToolEvent | null;
  isStreaming: boolean;
  sessionId: string | null;
  selectedChillerId: string | null;
  patternCounts: Record<string, number>;
  sendMessage: (message: string, chillerId?: string | null) => Promise<void>;
  setSelectedChillerId: (id: string | null) => void;
  setSelectedInsight: (event: ToolEvent | null) => void;
  sendFeedback: (signal: "positive" | "negative") => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: string, data: unknown) => void
) {
  const decoder = new TextDecoder();
  let buffer = "";

  return (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7);
          if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (data) {
          try {
            onEvent(event, JSON.parse(data));
          } catch {
            // skip
          }
        }
      }
    }
  })();
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [evidence, setEvidence] = useState<EvidenceZone>({});
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<ToolEvent | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedChillerId, setSelectedChillerId] = useState<string | null>(null);
  const assistantBuffer = useRef("");
  const assistantId = useRef<string | null>(null);

  const patternCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of toolEvents) {
      const p = ev.query_insight?.pattern;
      if (p) counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, [toolEvents]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setEvidence({});
    setToolEvents([]);
    setActiveZone(null);
    setSelectedInsight(null);
    setSessionId(null);
    assistantBuffer.current = "";
    assistantId.current = null;
  }, []);

  const sendMessage = useCallback(async (message: string, chillerId?: string | null) => {
    const cid = chillerId ?? selectedChillerId;
    if (cid) setSelectedChillerId(cid);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    assistantBuffer.current = "";
    assistantId.current = `a-${Date.now()}`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, chiller_id: cid }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `Chat request failed (${res.status})`);
      }

      await parseSseStream(res.body.getReader(), (event, data) => {
        const payload = data as Record<string, unknown>;

        if (event === "assistant_delta") {
          assistantBuffer.current += (payload.text as string) || "";
          const content = assistantBuffer.current;
          const aid = assistantId.current!;
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === aid);
            if (existing) {
              return prev.map((m) => (m.id === aid ? { ...m, content } : m));
            }
            return [...prev, { id: aid, role: "assistant", content }];
          });
        }

        if (event === "tool_start") {
          const te: ToolEvent = {
            id: `t-${Date.now()}-${payload.tool}`,
            tool: payload.tool as string,
            args: (payload.args as Record<string, unknown>) || {},
            timestamp: Date.now(),
            round: payload.round as number | undefined,
          };
          setToolEvents((prev) => [...prev, te]);
        }

        if (event === "tool_result") {
          const te: ToolEvent = {
            id: `t-${Date.now()}-${payload.tool}`,
            tool: payload.tool as string,
            args: (payload.args as Record<string, unknown>) || {},
            result: payload.result as Record<string, unknown>,
            latency_ms: payload.latency_ms as number,
            query_insight: payload.query_insight as ToolEvent["query_insight"],
            timestamp: Date.now(),
            round: payload.round as number | undefined,
          };
          setToolEvents((prev) => {
            const idx = prev.findIndex(
              (e) => e.tool === te.tool && !e.result && Date.now() - e.timestamp < 30000
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...te };
              return next;
            }
            return [...prev, te];
          });
          setSelectedInsight(te);
        }

        if (event === "evidence_update") {
          const zone = payload.zone as keyof EvidenceZone;
          setActiveZone(zone);
          setEvidence((prev) => ({ ...prev, [zone]: payload.summary }));
          setTimeout(() => setActiveZone(null), 2000);
        }

        if (event === "done") {
          if (payload.session_id) setSessionId(payload.session_id as string);
        }

        if (event === "error") {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: `Error: ${payload.message}`,
            },
          ]);
        }
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [selectedChillerId]);

  const sendFeedback = useCallback(async (signal: "positive" | "negative") => {
    if (!sessionId) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, signal }),
    });
  }, [sessionId]);

  const value: ChatContextValue = {
    messages,
    evidence,
    toolEvents,
    activeZone,
    selectedInsight,
    isStreaming,
    sessionId,
    selectedChillerId,
    patternCounts,
    sendMessage,
    setSelectedChillerId,
    setSelectedInsight,
    sendFeedback,
    clearChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function usePatternSummary() {
  const { patternCounts } = useChat();
  return Object.entries(patternCounts) as [QueryPattern, number][];
}
