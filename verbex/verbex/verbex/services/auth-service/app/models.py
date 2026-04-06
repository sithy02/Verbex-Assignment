from pydantic import BaseModel, EmailStr
from typing import Any

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenData(BaseModel):
    token: str

class UserData(BaseModel):
    userId: str
    email: str

class SuccessResponse(BaseModel):
    data: Any

class ErrorResponse(BaseModel):
    error: str
