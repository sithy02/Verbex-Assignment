from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/dbname"
    AUTH_SERVICE_URL: str = "http://localhost:8081"
    AGENT_SERVICE_URL: str = "http://localhost:8082"
    OPENROUTER_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
