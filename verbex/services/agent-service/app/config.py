from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/dbname"
    AUTH_SERVICE_URL: str = "http://localhost:8081"
    CHAT_SERVICE_URL: str = "http://localhost:8083"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

FREE_MODELS = [
    {"label": "Claude 3.5 Sonnet — Fast & Smart", "value": "anthropic/claude-3-5-sonnet"},
    {"label": "Claude 3 Haiku — Lightweight & Quick", "value": "anthropic/claude-3-haiku"},
    {"label": "GPT-4O Mini — OpenAI Budget", "value": "openai/gpt-4o-mini"},
]
