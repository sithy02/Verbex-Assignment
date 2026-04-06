# ⚡ Verbex — AI Agent Platform

A SaaS platform to create AI chatbot agents and embed them on any website with real-time streaming responses.

## 🎯 Features

- ✅ **Create multi-purpose AI agents** with custom system prompts
- ✅ **Public chat URLs** - Share agent links without authentication
- ✅ **Real-time streaming** - Responses appear token-by-token as they're generated
- ✅ **Conversation persistence** - History saved per conversation
- ✅ **Analytics dashboard** - Track conversations, messages, and activity
- ✅ **API key authentication** - Programmatic access for integrations
- ✅ **Webhook support** - Notify external systems of conversations
- ✅ **Multi-model LLM support** - OpenRouter + local Ollama fallback

## Stack

| Layer     | Tech                                       |
| --------- | ------------------------------------------ |
| Backend   | Python 3.11 + FastAPI (async)              |
| Database  | NeonDB (Postgres) via SQLAlchemy + asyncpg |
| Frontend  | Next.js 15 (TypeScript)                    |
| LLM       | OpenRouter (with Ollama local fallback)    |
| Container | Docker + Docker Compose                    |

## Services

| Service       | Port | Responsibility                                  |
| ------------- | ---- | ----------------------------------------------- |
| auth-service  | 8081 | Signup, login, JWT, API key verification        |
| agent-service | 8082 | Agent CRUD, API key management, analytics       |
| chat-service  | 8083 | Chat, conversation history, webhooks, streaming |
| frontend      | 3000 | Next.js UI + public chat interface              |

---

## 📋 Setup Instructions

### Prerequisites

- Docker & Docker Compose installed
- NeonDB or PostgreSQL instance (free tier: https://neon.tech)
- OpenRouter account with API key (free: https://openrouter.ai)

### Step 1: Clone & Configure

```bash
# Clone the repository
git clone <repo-url>
cd verbex

# Copy environment template
cp .env.example .env
```

### Step 2: Set Environment Variables

Edit `.env` with your credentials:

```env
# ── Database (NeonDB) ──────────────────────────────────────────
# Get from https://neon.tech - MUST use postgresql+asyncpg:// prefix
DATABASE_URL=postgresql+asyncpg://neondb_owner:password@ep-xxx.ap-southeast-1.aws.neon.tech/verbex

# ── Auth ───────────────────────────────────────────────────────
# Generate: openssl rand -hex 32
JWT_SECRET=your-64-char-random-string-here

# ── LLM ────────────────────────────────────────────────────────
# Get from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxx...

# ── Inter-service URLs (Docker internal) ───────────────────────
AUTH_SERVICE_URL=http://auth-service:8081
AGENT_SERVICE_URL=http://agent-service:8082
CHAT_SERVICE_URL=http://chat-service:8083

# ── Frontend (browser-accessible) ─────────────────────────────
NEXT_PUBLIC_AUTH_URL=http://localhost:8081
NEXT_PUBLIC_AGENT_URL=http://localhost:8082
NEXT_PUBLIC_CHAT_URL=http://localhost:8083
```

### Step 3: Start Services

```bash
# Build and run all services
docker-compose up --build

# Or in background
docker-compose up -d --build
```

### Step 4: Verify

```bash
# Check all services are running
docker ps

# Visit the application
# Frontend: http://localhost:3000
# Auth API: http://localhost:8081
# Agent API: http://localhost:8082
# Chat API: http://localhost:8083
```

### Step 5: Create First Agent

1. Go to http://localhost:3000
2. Sign up with email/password
3. Click "+ New Agent"
4. Fill in agent name, system prompt, and select LLM model
5. Click "Create Agent"
6. View the public chat URL for your agent

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│                    http://localhost:3000                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Agents Page       Chat Page        Conversations Page   │   │
│  │  - Create agent    - Real-time      - View history       │   │
│  │  - View analytics    streaming      - Conversation stats │   │
│  │  - Share URL       - No auth needed                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                      │
         │ JWT/Bearer         │ Public Access        │ JWT
         ▼                    ▼                      ▼
    ┌─────────┐          ┌─────────┐           ┌─────────┐
    │  Auth   │          │  Chat   │           │ Agent   │
    │ Service │          │ Service │           │ Service │
    │ :8081   │◄────────►│ :8083   │◄─────────►│ :8082   │
    └─────────┘          └─────────┘           └─────────┘
         │                    │                      │
         └────────────────────┴──────────────────────┘
                            │
                      NeonDB/PostgreSQL
                    (Conversations & Messages)
                            │
         ┌──────────────────┴──────────────────┐
         │                                      │
    ┌─────────────┐                   ┌──────────────────┐
    │ OpenRouter  │                   │ Ollama (local)   │
    │  LLM API    │ (fallback if)      │ LLM (fallback)   │
    │  - Streaming│                   │ - Free models    │
    │  - Multiple │                   │ - No API key     │
    │    models   │                   └──────────────────┘
    └─────────────┘
```

---

## 📡 API Documentation

### Public Chat Endpoint (No Auth Required)

#### `POST /chat/stream` — Send message with streaming response

**URL**: `http://localhost:8083/chat/stream`

**Request**:

```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "What is machine learning?",
  "conversationId": null
}
```

**Response** (Server-Sent Events):

```
data: {"conversationId":"550e8400-e29b-41d4-a716-446655440001"}

data: {"chunk":"Machine"}

data: {"chunk":" learning"}

data: {"chunk":" is a subset"}

data: [DONE]
```

**Usage Example** (Frontend):

```typescript
const response = await fetch("http://localhost:8083/chat/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agentId: "your-agent-id",
    message: "Hello!",
    conversationId: null,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const json = JSON.parse(text.slice(6)); // Remove "data: " prefix
  if (json.chunk) {
    console.log(json.chunk); // Append to UI
  }
}
```

### Auth Service

#### `POST /auth/signup` — Register new user

```bash
curl -X POST http://localhost:8081/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123"}'
```

**Response**:

```json
{
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-04-07T12:34:56Z"
  }
}
```

#### `POST /auth/login` — Login and get JWT

```bash
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123"}'
```

### Agent Service

#### `POST /agents` — Create new agent

```bash
curl -X POST http://localhost:8082/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Finance Advisor",
    "system_prompt": "You are a financial advisor...",
    "model": "anthropic/claude-3-haiku",
    "temperature": 0.7,
    "webhook_url": "https://example.com/webhook"
  }'
```

**Response**:

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Finance Advisor",
    "model": "anthropic/claude-3-haiku",
    "temperature": 0.7,
    "created_at": "2026-04-06T10:30:00Z"
  }
}
```

#### `GET /agents` — List your agents

```bash
curl http://localhost:8082/agents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### `GET /agents/:id/analytics` — Get agent statistics

```bash
curl http://localhost:8082/agents/550e8400-e29b-41d4-a716-446655440001/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:

```json
{
  "data": {
    "totalConversations": 42,
    "totalMessages": 156,
    "lastActivity": "2026-04-06T15:22:00Z"
  }
}
```

#### `GET /agents/public/:id` — Get agent (no auth, for public chat)

```bash
curl http://localhost:8082/agents/public/550e8400-e29b-41d4-a716-446655440001
```

### Chat Service

#### `GET /conversations/:agentId` — List conversations

```bash
curl http://localhost:8083/conversations/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### `GET /messages/:conversationId` — Get conversation messages

```bash
curl http://localhost:8083/messages/550e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:

```json
{
  "data": [
    {
      "role": "user",
      "content": "What is machine learning?",
      "createdAt": "2026-04-06T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "Machine learning is...",
      "createdAt": "2026-04-06T10:30:05Z"
    }
  ]
}
```

#### `GET /analytics/:agentId` — Get agent statistics

```bash
curl http://localhost:8083/analytics/550e8400-e29b-41d4-a716-446655440001
```

---

## 🤖 AI Tools Usage & Development Insights

### Tools Used

1. **GitHub Copilot Chat** - Primary AI assistant for:
   - Code generation and refactoring
   - Bug identification and fixes
   - Architecture design suggestions
   - Test case generation
   - Documentation and comments

2. **VS Code Extensions Used**:
   - Copilot (main coding assistant)
   - Python IntelliSense (via Pylance)
   - TypeScript IntelliSense

### Time Saved Estimate

- **Without AI**: 40-50 hours
- **With AI**: 12-15 hours
- **Productivity Gain**: ~70% faster development

### Breakdown:

- Backend setup & debugging: 5 hours saved
- Frontend components: 8 hours saved
- API integration & error handling: 5 hours saved
- Documentation: 3 hours saved

### Helpful Prompt Example

```
I need to implement streaming responses for chat. The frontend needs to
consume Server-Sent Events and display tokens as they arrive. The backend
should use FastAPI StreamingResponse. Show me:

1. Backend route with generate_reply_stream() async generator
2. Frontend code to consume the SSE stream
3. How to parse "data: {...}" format and update UI in real-time
4. Error handling for both sides

Make it production-ready with proper error boundaries.
```

**Result**: Got a complete, working implementation with proper error handling in ~5 minutes instead of 45+ minutes of manual coding and debugging.

### Challenge Faced

**Problem**: OpenRouter free models started returning 404 "No endpoints found" errors mid-development.

**Root Cause**: The platform deprecated free tier access to certain models (Mistral 7B, LLaMA 3.1).

**Solution with AI**:

- Identified the issue by analyzing error patterns from logs
- Suggested trying different model IDs
- Implemented multi-level fallback: OpenRouter models → Ollama local instance
- Added comprehensive logging to track which models fail
- Updated config with currently working free models

**Result**: System now gracefully degrades and provides helpful error messages to users about credit requirements.

---

## Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker --version

# Rebuild without cache
docker-compose build --no-cache

# Check logs
docker logs verbex-chat-service-1
docker logs verbex-frontend-1
```

### Database connection errors

Verify in `.env`:

- `DATABASE_URL` uses `postgresql+asyncpg://` prefix (not `postgresql://`)
- Host is reachable from Docker containers
- Connection limits not exceeded on NeonDB

### LLM responses unavailable

Check:

1. Is `OPENROUTER_API_KEY` set and valid?
2. Does account have active credits? (Check https://openrouter.ai)
3. Is Ollama running locally if using fallback? (`ollama serve`)
4. Check logs: `docker logs verbex-chat-service-1 | grep LLM`

### Frontend blank page

```bash
# Restart frontend
docker-compose restart frontend

# Check logs
docker logs verbex-frontend-1

# Clear browser cache (Ctrl+Shift+R)
```

---

## 📄 Key Fixes Applied

| Issue                 | Fix                                                       |
| --------------------- | --------------------------------------------------------- |
| Missing async driver  | Added `asyncpg==0.29.0` to requirements                   |
| LLM model errors      | Implemented multi-provider fallback (OpenRouter → Ollama) |
| CORS failures         | Enabled `CORSMiddleware` with `allow_origins=["*"]`       |
| Streaming responses   | Implemented Server-Sent Events (SSE) for real-time chat   |
| Database connectivity | Auto-converts PostgreSQL URLs to asyncpg format           |

---

## License

MIT
