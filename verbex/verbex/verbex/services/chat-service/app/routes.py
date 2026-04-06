from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.models import ChatRequest
from app.config import settings
from app import service
from app.llm import generate_reply, generate_reply_stream
from app.webhooks import schedule_webhook
import httpx
import json

router = APIRouter()

# ── Auth helpers ──────────────────────────────────────────────────────────────

async def get_current_user_from_token(token: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.AUTH_SERVICE_URL}/auth/verify",
                headers={"Authorization": f"Bearer {token}"}
            )
            if resp.status_code == 200:
                return resp.json()["data"]
    except Exception:
        pass
    return None

async def verify_api_key_user(api_key: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.AUTH_SERVICE_URL}/auth/verify-apikey",
                headers={"x-api-key": api_key}
            )
            if resp.status_code == 200:
                return resp.json()["data"]
    except Exception:
        pass
    return None

async def require_auth(request: Request) -> dict:
    """Require JWT bearer token"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")
    token = auth.removeprefix("Bearer ").strip()
    user = await get_current_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user

# ── Chat ──────────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(body: ChatRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 1. Fetch agent (public — no auth)
    agent = await service.get_agent_public(body.agentId)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 2. Optional API key auth
    api_key = request.headers.get("x-api-key")
    if api_key:
        key_user = await verify_api_key_user(api_key)
        if not key_user:
            raise HTTPException(status_code=401, detail="Invalid API key")

    # 3. Get or create conversation
    conversation, is_new = await service.get_or_create_conversation(
        db, body.agentId, body.conversationId
    )

    # 4. Fire webhook on new conversation (non-blocking)
    if is_new and agent.get("webhook_url"):
        schedule_webhook(agent["webhook_url"], body.agentId, str(conversation.id))

    # 5. Save user message
    await service.save_message(db, str(conversation.id), "user", body.message)

    # 6. Build message history (last 10 + system prompt)
    recent = await service.get_recent_messages(db, str(conversation.id), limit=10)
    messages = [{"role": "system", "content": agent["system_prompt"]}]
    messages += [{"role": m.role, "content": m.content} for m in recent]

    # 7. Call LLM
    reply = await generate_reply(messages, agent["model"], agent["temperature"])

    # 8. Save AI reply
    await service.save_message(db, str(conversation.id), "assistant", reply)

    # 9. Return response
    return JSONResponse(
        status_code=200,
        content={"data": {"reply": reply, "conversationId": str(conversation.id)}},
    )

@router.post("/chat/stream")
async def chat_stream(body: ChatRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Chat endpoint with streaming response"""
    # 1. Fetch agent (public — no auth)
    agent = await service.get_agent_public(body.agentId)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 2. Optional API key auth
    api_key = request.headers.get("x-api-key")
    if api_key:
        key_user = await verify_api_key_user(api_key)
        if not key_user:
            raise HTTPException(status_code=401, detail="Invalid API key")

    # 3. Get or create conversation
    conversation, is_new = await service.get_or_create_conversation(
        db, body.agentId, body.conversationId
    )

    # 4. Fire webhook on new conversation (non-blocking)
    if is_new and agent.get("webhook_url"):
        schedule_webhook(agent["webhook_url"], body.agentId, str(conversation.id))

    # 5. Save user message
    await service.save_message(db, str(conversation.id), "user", body.message)

    # 6. Build message history (last 10 + system prompt)
    recent = await service.get_recent_messages(db, str(conversation.id), limit=10)
    messages = [{"role": "system", "content": agent["system_prompt"]}]
    messages += [{"role": m.role, "content": m.content} for m in recent]

    # 7. Generate streaming response
    async def stream_generator():
        # Send conversation ID first
        yield f"data: {json.dumps({'conversationId': str(conversation.id)})}\n\n"
        
        reply_text = ""
        async for chunk in generate_reply_stream(messages, agent["model"], agent["temperature"]):
            reply_text += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        
        # Save AI reply
        await service.save_message(db, str(conversation.id), "assistant", reply_text)
        
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

# ── Conversations ─────────────────────────────────────────────────────────────

@router.get("/conversations/{agent_id}")
async def list_conversations(
    agent_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await require_auth(request)
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()

    # Verify ownership
    owned = await service.verify_agent_ownership(agent_id, token)
    if not owned:
        raise HTTPException(status_code=403, detail="Not authorized to view this agent's conversations")

    conversations = await service.get_conversations_for_agent(db, agent_id)
    return JSONResponse(status_code=200, content={"data": conversations})

@router.get("/messages/{conversation_id}")
async def get_messages(
    conversation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await require_auth(request)
    messages = await service.get_messages_for_conversation(db, conversation_id)
    return JSONResponse(status_code=200, content={"data": messages})

# ── Analytics (called by agent-service) ──────────────────────────────────────

@router.get("/analytics/{agent_id}")
async def get_analytics(agent_id: str, db: AsyncSession = Depends(get_db)):
    analytics = await service.get_analytics_for_agent(db, agent_id)
    return JSONResponse(status_code=200, content={"data": analytics})
