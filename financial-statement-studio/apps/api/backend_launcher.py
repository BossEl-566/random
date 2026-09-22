from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config


BACKEND_HOST = os.getenv(
    "BACKEND_HOST",
    "127.0.0.1",
)

BACKEND_PORT = int(
    os.getenv(
        "BACKEND_PORT",
        "8000",
    )
)


def get_runtime_directory() -> Path:
    """
    Return the directory containing the packaged backend resources.

    During normal development this is the apps/api directory.

    When bundled by PyInstaller, bundled files are extracted beneath
    sys._MEIPASS.
    """

    if getattr(
        sys,
        "frozen",
        False,
    ):
        return Path(
            sys._MEIPASS  # type: ignore[attr-defined]
        )

    return Path(
        __file__,
    ).resolve().parent


def run_database_migrations() -> None:
    """
    Upgrade the configured database to the latest Alembic revision
    before the API begins accepting requests.
    """

    runtime_directory = (
        get_runtime_directory()
    )

    alembic_ini = (
        runtime_directory
        / "alembic.ini"
    )

    migrations_directory = (
        runtime_directory
        / "migrations"
    )

    if not alembic_ini.exists():
        raise RuntimeError(
            "Alembic configuration was not found at "
            f"{alembic_ini}"
        )

    if not migrations_directory.exists():
        raise RuntimeError(
            "Alembic migrations were not found at "
            f"{migrations_directory}"
        )

    config = Config(
        str(
            alembic_ini,
        )
    )

    config.set_main_option(
        "script_location",
        str(
            migrations_directory,
        ),
    )

    command.upgrade(
        config,
        "head",
    )


def start_api() -> None:
    """
    Start the local Financial Statement Studio API.
    """

    uvicorn.run(
        "app.main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        log_level="info",
    )


def main() -> None:
    print(
        "[Backend] Applying database migrations..."
    )

    run_database_migrations()

    print(
        "[Backend] Database is ready."
    )

    print(
        "[Backend] Starting Financial Statement Studio API..."
    )

    start_api()


if __name__ == "__main__":
    main()