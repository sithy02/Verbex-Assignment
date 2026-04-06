from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.schema import Agent, APIKey
from app.utils import generate_api_key, hash_api_key
from app.config import settings
import httpx
import uuid

def agent_to_dict(agent: Agent) -> dict:
    return {
        "id": str(agent.id),
        "user_id": str(agent.user_id),
        "name": agent.name,
        "system_prompt": agent.system_prompt,
        "temperature": float(agent.temperature),
        "model": agent.model,
        "webhook_url": agent.webhook_url,
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
    }

async def create_agent(db: AsyncSession, user_id: str, data: dict) -> Agent:
    agent = Agent(
        user_id=uuid.UUID(user_id),
        name=data["name"],
        system_prompt=data["system_prompt"],
        temperature=data.get("temperature", 0.7),
        model=data.get("model", "mistralai/mistral-7b-instruct:free"),
        webhook_url=data.get("webhook_url"),
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent

async def list_agents(db: AsyncSession, user_id: str) -> list[Agent]:
    result = await db.execute(select(Agent).where(Agent.user_id == uuid.UUID(user_id)))
    return result.scalars().all()

async def get_agent(db: AsyncSession, agent_id: str, user_id: str) -> Agent | None:
    result = await db.execute(
        select(Agent).where(Agent.id == uuid.UUID(agent_id), Agent.user_id == uuid.UUID(user_id))
    )
    return result.scalar_one_or_none()

async def get_agent_public(db: AsyncSession, agent_id: str) -> Agent | None:
    result = await db.execute(select(Agent).where(Agent.id == uuid.UUID(agent_id)))
    return result.scalar_one_or_none()

async def delete_agent(db: AsyncSession, agent_id: str, user_id: str) -> bool:
    agent = await get_agent(db, agent_id, user_id)
    if not agent:
        return False
    await db.delete(agent)
    await db.commit()
    return True

async def create_or_replace_api_key(db: AsyncSession, user_id: str) -> str:
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)

    # Delete old key if exists
    await db.execute(delete(APIKey).where(APIKey.user_id == uuid.UUID(user_id)))

    api_key = APIKey(user_id=uuid.UUID(user_id), key_hash=key_hash)
    db.add(api_key)
    await db.commit()
    return raw_key

async def get_api_key_info(db: AsyncSession, user_id: str) -> APIKey | None:
    result = await db.execute(select(APIKey).where(APIKey.user_id == uuid.UUID(user_id)))
    return result.scalar_one_or_none()

async def get_agent_analytics(agent_id: str) -> dict:
    """Fetch analytics from chat-service"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.CHAT_SERVICE_URL}/analytics/{agent_id}")
            if resp.status_code == 200:
                return resp.json().get("data", {})
    except Exception:
        pass
    return {"totalConversations": 0, "totalMessages": 0, "lastActivity": None}
