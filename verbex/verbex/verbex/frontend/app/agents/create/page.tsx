"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAgent, fetchModels } from "@/lib/api";

interface Model {
  label: string;
  value: string;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [temperature, setTemperature] = useState(0.7);
  const [model, setModel] = useState("mistralai/mistral-7b-instruct:free");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/auth/login"); return; }
    fetchModels().then(setModels).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createAgent({
        name,
        system_prompt: systemPrompt,
        temperature,
        model,
        webhook_url: webhookUrl || undefined,
      });
      router.push("/agents");
    } catch (err: any) {
      setError(err.message || "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: "600px" }}>
      <div className="page-header">
        <h1 className="page-title">Create Agent</h1>
        <button className="btn btn-secondary" onClick={() => router.push("/agents")}>
          ← Back
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <label className="label">Agent Name *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Support Bot"
            required
          />
        </div>

        <div>
          <label className="label">System Prompt *</label>
          <textarea
            className="input"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Describe how your agent should behave…"
            rows={5}
            required
            style={{ resize: "vertical" }}
          />
        </div>

        <div>
          <label className="label">Model</label>
          <select
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.length > 0
              ? models.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)
              : <option value={model}>{model}</option>}
          </select>
        </div>

        <div>
          <label className="label">Temperature: {temperature}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-dim)" }}>
            <span>Precise (0)</span>
            <span>Creative (1)</span>
          </div>
        </div>

        <div>
          <label className="label">Webhook URL (optional)</label>
          <input
            className="input"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
          />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "5px" }}>
            Fired on every new conversation start.
          </p>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create Agent"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => router.push("/agents")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
