# =============================================================================
#  src/infrastructure/config.py
# =============================================================================
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:pass@localhost/icfes_db"
    redis_url: str = "redis://localhost:6379"
    anthropic_api_key: str = ""
    google_application_credentials: str = ""
    secret_key: str = "change-me-in-production"
    app_env: str = "development"
    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    frontend_url: str = "https://ifces-wmo9.vercel.app"

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    class Config:
        env_file = ".env"

settings = Settings()
