"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAgents,
  deleteAgent,
  fetchApiKeyStatus,
  generateApiKey,
  fetchAgentAnalytics,
} from "@/lib/api";

interface Analytics {
  totalConversations: number;
  totalMessages: number;
  lastActivity?: string;
}

interface Agent {
  id: string;
  name: string;
  model: string;
  temperature: number;
  created_at: string;
}

interface AgentWithAnalytics extends Agent {
  analytics?: Analytics;
  analyticsLoading?: boolean;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentWithAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyCreatedAt, setApiKeyCreatedAt] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(""); // clear any previous error before fetching
    try {
      const [agentData, keyData] = await Promise.all([
        fetchAgents(),
        fetchApiKeyStatus(),
      ]);
      setAgents(agentData);
      setError(""); // clear again after success
      setHasApiKey(keyData.hasKey);
      setApiKeyCreatedAt(keyData.createdAt);

      // Load analytics for each agent
      agentData.forEach((agent: Agent) => loadAgentAnalytics(agent.id));
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadAgentAnalytics(agentId: string) {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, analyticsLoading: true } : a,
      ),
    );
    try {
      const analyticsData = await fetchAgentAnalytics(agentId);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, analytics: analyticsData, analyticsLoading: false }
            : a,
        ),
      );
    } catch (err) {
      // Silently fail analytics loading
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId ? { ...a, analyticsLoading: false } : a,
        ),
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete agent");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerateKey() {
    setKeyLoading(true);
    setNewKey(null);
    try {
      const data = await generateApiKey();
      setNewKey(data.key);
      setHasApiKey(true);
      setApiKeyCreatedAt(new Date().toISOString());
    } catch (err: any) {
      alert(err.message || "Failed to generate API key");
    } finally {
      setKeyLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/auth/login");
  }

  function formatLastActivity(timestamp?: string): string {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">⚡ Verbex</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/agents/create")}
          >
            + New Agent
          </button>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Agents */}
      <section style={{ marginBottom: "36px" }}>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "14px",
            color: "var(--text-muted)",
          }}
        >
          YOUR AGENTS
        </h2>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading agents…</p>
        ) : error ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <p className="error-msg">{error}</p>
            <button
              className="btn btn-secondary"
              onClick={loadData}
              style={{ width: "fit-content" }}
            >
              Retry
            </button>
          </div>
        ) : agents.length === 0 ? (
          <div
            className="card"
            style={{ textAlign: "center", padding: "40px" }}
          >
            <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
              No agents yet.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => router.push("/agents/create")}
            >
              Create your first agent
            </button>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {agents.map((agent) => (
              <div key={agent.id} className="card">
                {/* Agent Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                      {agent.name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {agent.model} · temp {agent.temperature}
                    </p>
                  </div>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={() => router.push(`/chat/${agent.id}`)}
                    >
                      💬 Chat
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        router.push(`/agents/conversations?id=${agent.id}`)
                      }
                    >
                      📋 Conversations
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(agent.id)}
                      disabled={deletingId === agent.id}
                    >
                      {deletingId === agent.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Analytics */}
                {agent.analyticsLoading ? (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      marginTop: "8px",
                    }}
                  >
                    Loading analytics…
                  </p>
                ) : agent.analytics ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "12px",
                      padding: "12px 0 0 0",
                      borderTop: "1px solid var(--border)",
                      marginTop: "12px",
                    }}
                  >
                    <div style={{ padding: "8px 0" }}>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          fontWeight: 500,
                        }}
                      >
                        Conversations
                      </p>
                      <p
                        style={{
                          fontSize: "20px",
                          fontWeight: 700,
                          marginTop: "4px",
                        }}
                      >
                        {agent.analytics.totalConversations}
                      </p>
                    </div>
                    <div style={{ padding: "8px 0" }}>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          fontWeight: 500,
                        }}
                      >
                        Total Messages
                      </p>
                      <p
                        style={{
                          fontSize: "20px",
                          fontWeight: 700,
                          marginTop: "4px",
                        }}
                      >
                        {agent.analytics.totalMessages}
                      </p>
                    </div>
                    <div style={{ padding: "8px 0" }}>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          fontWeight: 500,
                        }}
                      >
                        Last Activity
                      </p>
                      <p style={{ fontSize: "13px", marginTop: "4px" }}>
                        {formatLastActivity(agent.analytics.lastActivity)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Public URL */}
                <div
                  style={{
                    padding: "12px 0 0 0",
                    borderTop: "1px solid var(--border)",
                    marginTop: "12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Public Chat URL
                  </p>
                  <code
                    style={{
                      fontSize: "12px",
                      background: "var(--surface2)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      display: "block",
                      wordBreak: "break-all",
                      cursor: "pointer",
                      color: "var(--accent)",
                    }}
                    onClick={() => {
                      const url = `${window.location.origin}/chat/${agent.id}`;
                      navigator.clipboard.writeText(url);
                    }}
                    title="Click to copy"
                  >
                    {`${window.location.origin}/chat/${agent.id}`}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API Key */}
      <section>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "14px",
            color: "var(--text-muted)",
          }}
        >
          API KEY
        </h2>
        <div className="card">
          {newKey ? (
            <div>
              <p
                style={{
                  marginBottom: "10px",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                }}
              >
                ⚠️ Copy this key now — it won&apos;t be shown again.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <code style={styles.keyCode}>{newKey}</code>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigator.clipboard.writeText(newKey)}
                >
                  Copy
                </button>
              </div>
            </div>
          ) : hasApiKey ? (
            <div>
              <p style={{ fontSize: "14px", marginBottom: "4px" }}>
                ✅ API key active
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginBottom: "14px",
                }}
              >
                Created{" "}
                {apiKeyCreatedAt
                  ? new Date(apiKeyCreatedAt).toLocaleDateString()
                  : "—"}
              </p>
              <button
                className="btn btn-secondary"
                onClick={handleGenerateKey}
                disabled={keyLoading}
              >
                {keyLoading ? "Regenerating…" : "Regenerate Key"}
              </button>
            </div>
          ) : (
            <div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-muted)",
                  marginBottom: "14px",
                }}
              >
                No API key yet. Generate one to use the chat API
                programmatically.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleGenerateKey}
                disabled={keyLoading}
              >
                {keyLoading ? "Generating…" : "Generate API Key"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  keyCode: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 12px",
    fontSize: "12px",
    fontFamily: "monospace",
    wordBreak: "break-all",
    flex: 1,
  },
};
