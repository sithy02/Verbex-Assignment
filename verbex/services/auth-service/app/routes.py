from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import SignupRequest, LoginRequest
from app import service
from app.schema import User
from sqlalchemy import select
import hashlib

router = APIRouter(prefix="/auth")

@router.post("/signup")
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await service.get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    user = await service.create_user(db, body.email, body.password)
    token = service.create_token(str(user.id), user.email)
    return JSONResponse(status_code=200, content={"data": {"token": token}})

@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await service.get_user_by_email(db, body.email)
    if not user or not service.verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = service.create_token(str(user.id), user.email)
    return JSONResponse(status_code=200, content={"data": {"token": token}})

@router.get("/verify")
async def verify(authorization: str = Header(...), db: AsyncSession = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    token = authorization.removeprefix("Bearer ").strip()
    payload = service.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return JSONResponse(status_code=200, content={"data": {"userId": payload["sub"], "email": payload["email"]}})

@router.get("/verify-apikey")
async def verify_apikey(x_api_key: str = Header(...), db: AsyncSession = Depends(get_db)):
    from app.schema import User
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    # Import APIKey from agent-service schema not available here — 
    # auth-service stores api_keys via a lightweight lookup table.
    # We check the api_keys table directly (shared DB).
    from sqlalchemy import text
    result = await db.execute(
        text("SELECT user_id FROM api_keys WHERE key_hash = :hash"),
        {"hash": key_hash}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return JSONResponse(status_code=200, content={"data": {"userId": str(row[0])}})
