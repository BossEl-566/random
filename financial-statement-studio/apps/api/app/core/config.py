from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


API_DIRECTORY = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIRECTORY = API_DIRECTORY / "data"
DEFAULT_DATABASE_PATH = DEFAULT_DATA_DIRECTORY / "accounting.db"


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    app_name: str = "Financial Statement Studio API"
    environment: str = "development"
    api_prefix: str = "/api"
    frontend_origin: str = "http://localhost:3000"

    data_dir: Path = DEFAULT_DATA_DIRECTORY
    database_url: str = (
        f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
    )

    model_config = SettingsConfigDict(
        env_file=str(API_DIRECTORY / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()