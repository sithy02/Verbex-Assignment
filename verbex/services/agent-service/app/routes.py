from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import CreateAgentRequest
from app.config import settings, FREE_MODELS
from app import service
import httpx

router = APIRouter()

# ── Auth helper ──────────────────────────────────────────────────────────────

async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    token = authorization.removeprefix("Bearer ").strip()
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
    raise HTTPException(status_code=401, detail="Invalid or expired token")

# ── Agent routes ─────────────────────────────────────────────────────────────

@router.post("/agents")
async def create_agent(
    body: CreateAgentRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.create_agent(db, user["userId"], body.model_dump())
    return JSONResponse(status_code=201, content={"data": service.agent_to_dict(agent)})

@router.get("/agents")
async def list_agents(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agents = await service.list_agents(db, user["userId"])
    return JSONResponse(status_code=200, content={"data": [service.agent_to_dict(a) for a in agents]})

@router.get("/agents/public/{agent_id}")
async def get_agent_public(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await service.get_agent_public(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return JSONResponse(status_code=200, content={"data": service.agent_to_dict(agent)})

@router.get("/agents/{agent_id}/analytics")
async def get_analytics(
    agent_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id, user["userId"])
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or not owned by user")
    analytics = await service.get_agent_analytics(agent_id)
    return JSONResponse(status_code=200, content={"data": analytics})

@router.get("/agents/{agent_id}")
async def get_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id, user["userId"])
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or not owned by user")
    return JSONResponse(status_code=200, content={"data": service.agent_to_dict(agent)})

@router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_agent(db, agent_id, user["userId"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found or not owned by user")
    return JSONResponse(status_code=204, content=None)

# ── API Key routes ────────────────────────────────────────────────────────────

@router.post("/apikeys")
async def create_api_key(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_key = await service.create_or_replace_api_key(db, user["userId"])
    return JSONResponse(status_code=201, content={"data": {"key": raw_key}})

@router.get("/apikeys")
async def get_api_key_status(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key_info = await service.get_api_key_info(db, user["userId"])
    if not key_info:
        return JSONResponse(status_code=200, content={"data": {"hasKey": False, "createdAt": None}})
    return JSONResponse(
        status_code=200,
        content={"data": {"hasKey": True, "createdAt": key_info.created_at.isoformat()}},
    )

# ── Models route ──────────────────────────────────────────────────────────────

@router.get("/models")
async def list_models():
    return JSONResponse(status_code=200, content={"data": FREE_MODELS})
