from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db


router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    application: str
    environment: str
    database: str
    timestamp: datetime


@router.get("", response_model=HealthResponse)
def health_check(
    database_session: Session = Depends(get_db),
) -> HealthResponse:
    """Confirm that the API and database are available."""

    try:
        database_session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is currently unavailable.",
        ) from error

    return HealthResponse(
        status="ok",
        application=settings.app_name,
        environment=settings.environment,
        database="connected",
        timestamp=datetime.now(timezone.utc),
    )