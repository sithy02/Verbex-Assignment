"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { sendMessageStream, fetchPublicAgent } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Agent {
  id: string;
  name: string;
  system_prompt?: string;
  model?: string;
}

export default function ChatPage() {
  const params = useParams();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load agent info
  useEffect(() => {
    if (!agentId) return;
    loadAgent();
  }, [agentId]);

  async function loadAgent() {
    try {
      const agentData = await fetchPublicAgent(agentId);
      setAgent(agentData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load agent");
    } finally {
      setAgentLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamingText]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !agentId) return;

    setInput("");
    setError("");
    setStreamingText("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const data = await sendMessageStream(
        agentId,
        text,
        conversationId,
        (chunk) => {
          setStreamingText((prev) => prev + chunk);
        },
      );

      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      setStreamingText("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  }

  if (agentLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>
              ⚡ Loading…
            </span>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: "var(--text-muted)" }}>Loading agent…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>⚡ Error</span>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <p className="error-msg">{error}</p>
            <button
              className="btn btn-secondary"
              onClick={loadAgent}
              style={{ marginTop: "10px" }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>
              ⚡ {agent?.name || "AI Assistant"}
            </span>
            {conversationId && (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-dim)",
                  fontFamily: "monospace",
                  marginLeft: "10px",
                }}
              >
                {conversationId.slice(0, 8)}…
              </span>
            )}
          </div>
          {agent?.model && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {agent.model}
            </span>
          )}
        </div>

        {/* Messages */}
        <div style={styles.messages}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              <p style={{ fontSize: "28px", marginBottom: "8px" }}>👋</p>
              <p style={{ color: "var(--text-muted)" }}>
                Hi! How can I help you today?
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  background:
                    msg.role === "user" ? "var(--accent)" : "var(--surface2)",
                  borderRadius:
                    msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && streamingText && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ ...styles.bubble, background: "var(--surface2)" }}>
                {streamingText}
                <span style={{ opacity: 0.6, marginLeft: "4px" }}>▌</span>
              </div>
            </div>
          )}
          {loading && !streamingText && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  ...styles.bubble,
                  background: "var(--surface2)",
                  color: "var(--text-muted)",
                }}
              >
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <p className="error-msg" style={{ textAlign: "center" }}>
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={styles.inputRow}>
          <input
            className="input"
            style={{ flex: 1, borderRadius: "24px", padding: "12px 18px" }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !input.trim()}
            style={{ borderRadius: "24px", padding: "12px 20px" }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  container: {
    width: "100%",
    maxWidth: "700px",
    height: "90vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px",
  },
  bubble: {
    maxWidth: "75%",
    padding: "12px 16px",
    fontSize: "14px",
    lineHeight: "1.6",
    wordBreak: "break-word",
  },
  inputRow: {
    padding: "16px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    background: "var(--surface)",
  },
};
