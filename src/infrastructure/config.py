# =============================================================================
#  src/infrastructure/config.py
# =============================================================================
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:pass@localhost/icfes_db"
    redis_url: str = "redis://localhost:6379"
    anthropic_api_key: str = ""
    google_application_credentials: str = ""
    secret_key: str = "change-me-in-production"
    app_env: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
