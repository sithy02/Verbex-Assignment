import uuid
from sqlalchemy import Column, String, DateTime, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String, nullable=False)
    system_prompt = Column(String, nullable=False)
    temperature = Column(Numeric(3, 2), default=0.7)
    model = Column(String, default="mistralai/mistral-7b-instruct:free")
    webhook_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    key_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
