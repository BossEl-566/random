from collections.abc import Generator

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


# Predictable database constraint names are important for migrations.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": (
        "fk_%(table_name)s_%(column_0_name)s_"
        "%(referred_table_name)s"
    ),
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(
    naming_convention=NAMING_CONVENTION,
)


class Base(DeclarativeBase):
    """Base class inherited by every SQLAlchemy database model."""

    metadata = metadata


# Ensure the SQLite data directory exists.
settings.data_dir.mkdir(
    parents=True,
    exist_ok=True,
)

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


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(
    dbapi_connection: object,
    connection_record: object,
) -> None:
    """
    Enable foreign-key enforcement for every SQLite connection.

    SQLite requires this setting to be enabled for each connection.
    """

    del connection_record

    if not settings.database_url.startswith("sqlite"):
        return

    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]

    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Provide a database session and close it after each request."""

    database_session = SessionLocal()

    try:
        yield database_session
    finally:
        database_session.close()