from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


# Ensure the folder for the SQLite database exists.
settings.data_dir.mkdir(parents=True, exist_ok=True)

sqlite_connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=sqlite_connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class inherited by all SQLAlchemy database models."""

    pass


def get_db() -> Generator[Session, None, None]:
    """Provide a database session and close it after each request."""

    database_session = SessionLocal()

    try:
        yield database_session
    finally:
        database_session.close()