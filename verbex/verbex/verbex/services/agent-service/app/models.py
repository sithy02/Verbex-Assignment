from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class CreateAgentRequest(BaseModel):
    name: str
    system_prompt: str
    temperature: Optional[float] = 0.7
    model: Optional[str] = "mistralai/mistral-7b-instruct:free"
    webhook_url: Optional[str] = None

class AgentResponse(BaseModel):
    id: str
    user_id: str
    name: str
    system_prompt: str
    temperature: float
    model: str
    webhook_url: Optional[str]
    created_at: str

class SuccessResponse(BaseModel):
    data: Any

class ErrorResponse(BaseModel):
    error: str
