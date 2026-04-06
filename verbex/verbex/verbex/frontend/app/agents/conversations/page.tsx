"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchConversations, fetchMessages } from "@/lib/api";

interface Conversation {
  id: string;
  startedAt: string;
  messageCount: number;
  firstMessage: string;
}

interface Message {
  role: string;
  content: string;
  createdAt: string;
}

// ── Inner component — uses useSearchParams() safely inside Suspense ──────────
function ConversationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Use searchParams.get("id") not useParams — agentId passed as query param
  const agentId = searchParams.get("id");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/auth/login"); return; }
    if (!agentId) { setError("No agent ID provided"); setLoading(false); return; }
    loadConversations(agentId);
  }, [agentId]);

  async function loadConversations(id: string) {
    setLoading(true);
    setError("");
    try {
      const data = await fetchConversations(id);
      setConversations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(convId: string) {
    setSelectedId(convId);
    setMsgsLoading(true);
    try {
      const data = await fetchMessages(convId);
      setMessages(data);
    } catch (err: any) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    } finally {
      setMsgsLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Conversations</h1>
        <button className="btn btn-secondary" onClick={() => router.push("/agents")}>← Back</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", alignItems: "start" }}>
        {/* Conversation list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : error ? (
            <p className="error-msg">{error}</p>
          ) : conversations.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No conversations yet.</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className="card"
                onClick={() => loadMessages(conv.id)}
                style={{
                  cursor: "pointer",
                  borderColor: selectedId === conv.id ? "var(--accent)" : undefined,
                  background: selectedId === conv.id ? "var(--accent-dim)" : undefined,
                }}
              >
                <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.firstMessage || "No messages"}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {conv.messageCount} messages · {conv.startedAt ? new Date(conv.startedAt).toLocaleDateString() : "—"}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Messages panel */}
        <div className="card" style={{ minHeight: "300px" }}>
          {!selectedId ? (
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Select a conversation to view messages.</p>
          ) : msgsLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading messages…</p>
          ) : messages.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No messages in this conversation.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius)",
                    background: msg.role === "user" ? "var(--accent)" : "var(--surface2)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page export — wraps content in Suspense (required by Next.js 15) ─────────
export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="page-container"><p style={{ color: "var(--text-muted)" }}>Loading…</p></div>}>
      <ConversationsContent />
    </Suspense>
  );
}
