from pydantic import BaseModel
from typing import Optional, Any

class ChatRequest(BaseModel):
    agentId: str
    message: str
    conversationId: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    conversationId: str

class SuccessResponse(BaseModel):
    data: Any

class ErrorResponse(BaseModel):
    error: str
