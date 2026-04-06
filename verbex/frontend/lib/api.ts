const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:8081";
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8082";
const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_URL || "http://localhost:8083";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signup(email: string, password: string) {
  const res = await fetch(`${AUTH_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.error || "Signup failed");
  return json.data;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.error || "Login failed");
  return json.data;
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function fetchAgents() {
  const res = await fetch(`${AGENT_URL}/agents`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to fetch agents");
  return json.data;
}

export async function fetchAgent(id: string) {
  const res = await fetch(`${AGENT_URL}/agents/${id}`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to fetch agent");
  return json.data;
}

export async function fetchPublicAgent(id: string) {
  const res = await fetch(`${AGENT_URL}/agents/public/${id}`);
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to fetch agent");
  return json.data;
}

export async function createAgent(data: {
  name: string;
  system_prompt: string;
  temperature: number;
  model: string;
  webhook_url?: string;
}) {
  const res = await fetch(`${AGENT_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to create agent");
  return json.data;
}

export async function deleteAgent(id: string) {
  const res = await fetch(`${AGENT_URL}/agents/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.detail || json.error || "Failed to delete agent");
  }
}

export async function fetchAnalytics(agentId: string) {
  const res = await fetch(`${AGENT_URL}/agents/${agentId}/analytics`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to fetch analytics");
  return json.data;
}

export async function fetchModels() {
  const res = await fetch(`${AGENT_URL}/models`);
  const json = await res.json();
  if (!res.ok) throw new Error("Failed to fetch models");
  return json.data;
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function generateApiKey() {
  const res = await fetch(`${AGENT_URL}/apikeys`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to generate API key");
  return json.data;
}

export async function fetchApiKeyStatus() {
  const res = await fetch(`${AGENT_URL}/apikeys`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(
      json.detail || json.error || "Failed to fetch API key status",
    );
  return json.data;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function sendMessage(
  agentId: string,
  message: string,
  conversationId?: string,
) {
  const res = await fetch(`${CHAT_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      message,
      conversationId: conversationId || null,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.error || "Chat failed");
  return json.data;
}

export async function sendMessageStream(
  agentId: string,
  message: string,
  conversationId?: string,
  onChunk?: (chunk: string) => void,
) {
  const res = await fetch(`${CHAT_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      message,
      conversationId: conversationId || null,
    }),
  });

  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.detail || json.error || "Chat failed");
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let metadata = { conversationId: "", reply: "" };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            continue;
          }
          try {
            const json = JSON.parse(data);
            if (json.chunk) {
              fullContent += json.chunk;
              onChunk?.(json.chunk);
            }
            if (json.conversationId) {
              metadata.conversationId = json.conversationId;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  metadata.reply = fullContent;
  return metadata;
}

export async function fetchConversations(agentId: string) {
  const res = await fetch(`${CHAT_URL}/conversations/${agentId}`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(
      json.detail || json.error || "Failed to fetch conversations",
    );
  return json.data;
}

export async function fetchMessages(conversationId: string) {
  const res = await fetch(`${CHAT_URL}/messages/${conversationId}`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to fetch messages");
  return json.data;
}

export async function fetchAgentAnalytics(agentId: string) {
  const res = await fetch(`${AGENT_URL}/agents/${agentId}/analytics`, {
    headers: { ...authHeaders() },
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.detail || json.error || "Failed to fetch analytics");
  return json.data;
}
