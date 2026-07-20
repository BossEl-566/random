from logging.config import fileConfig

from alembic import context

from app import models
from app.core.config import settings
from app.core.database import Base, engine


# Keep the models import because it registers all tables with Base.metadata.
del models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Alembic will use the same database URL as FastAPI.
config.set_main_option(
    "sqlalchemy.url",
    settings.database_url.replace("%", "%%"),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Generate migration SQL without connecting to the database.
    """

    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
        render_as_batch=settings.database_url.startswith(
            "sqlite",
        ),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Connect to the configured database and apply migrations.
    """

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=settings.database_url.startswith(
                "sqlite",
            ),
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()