from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.schema import Conversation, Message
from app.config import settings
import httpx
import uuid

async def get_or_create_conversation(db: AsyncSession, agent_id: str, conversation_id: str | None):
    """Return existing conversation or create a new one. Returns (conversation, is_new)."""
    if conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == uuid.UUID(conversation_id))
        )
        conv = result.scalar_one_or_none()
        if conv:
            return conv, False

    conv = Conversation(agent_id=uuid.UUID(agent_id))
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv, True

async def save_message(db: AsyncSession, conversation_id: str, role: str, content: str) -> Message:
    msg = Message(
        conversation_id=uuid.UUID(conversation_id),
        role=role,
        content=content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg

async def get_recent_messages(db: AsyncSession, conversation_id: str, limit: int = 10) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == uuid.UUID(conversation_id))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return list(reversed(messages))  # oldest first

async def get_conversations_for_agent(db: AsyncSession, agent_id: str) -> list[dict]:
    result = await db.execute(
        select(Conversation).where(Conversation.agent_id == uuid.UUID(agent_id))
        .order_by(Conversation.started_at.desc())
    )
    conversations = result.scalars().all()
    output = []
    for conv in conversations:
        # Count messages and get first user message
        count_result = await db.execute(
            select(func.count(Message.id)).where(Message.conversation_id == conv.id)
        )
        count = count_result.scalar() or 0
        first_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = first_msg_result.scalar_one_or_none()
        output.append({
            "id": str(conv.id),
            "startedAt": conv.started_at.isoformat() if conv.started_at else None,
            "messageCount": count,
            "firstMessage": first_msg.content[:100] if first_msg else "",
        })
    return output

async def get_messages_for_conversation(db: AsyncSession, conversation_id: str) -> list[dict]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == uuid.UUID(conversation_id))
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        {
            "role": m.role,
            "content": m.content,
            "createdAt": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]

async def get_analytics_for_agent(db: AsyncSession, agent_id: str) -> dict:
    conv_count_result = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.agent_id == uuid.UUID(agent_id))
    )
    total_conversations = conv_count_result.scalar() or 0

    # Total messages across all conversations for this agent
    msg_count_result = await db.execute(
        select(func.count(Message.id)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.agent_id == uuid.UUID(agent_id))
    )
    total_messages = msg_count_result.scalar() or 0

    # Last activity
    last_msg_result = await db.execute(
        select(Message.created_at).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.agent_id == uuid.UUID(agent_id))
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_activity_row = last_msg_result.scalar_one_or_none()

    return {
        "totalConversations": total_conversations,
        "totalMessages": total_messages,
        "lastActivity": last_activity_row.isoformat() if last_activity_row else None,
    }

async def get_agent_public(agent_id: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.AGENT_SERVICE_URL}/agents/public/{agent_id}")
            if resp.status_code == 200:
                return resp.json()["data"]
    except Exception:
        pass
    return None

async def verify_agent_ownership(agent_id: str, token: str) -> bool:
    """Verify user owns agent via agent-service"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.AGENT_SERVICE_URL}/agents/{agent_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            return resp.status_code == 200
    except Exception:
        return False
