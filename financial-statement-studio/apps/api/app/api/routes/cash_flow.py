from typing import NoReturn

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.cash_flow import (
    CashFlowReadinessResponse,
)
from app.services.cash_flow_readiness_service import (
    CashFlowReadinessService,
)
from app.services.journal_entry_service import (
    JournalEntryPersistenceError,
    JournalEntryServiceError,
    JournalReportNotFoundError,
)


cash_flow_router = APIRouter()

cash_flow_readiness_service = (
    CashFlowReadinessService()
)


def raise_cash_flow_http_error(
    error: JournalEntryServiceError,
) -> NoReturn:
    if isinstance(
        error,
        JournalReportNotFoundError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        JournalEntryPersistenceError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=str(error),
        ) from error

    raise HTTPException(
        status_code=(
            status.HTTP_500_INTERNAL_SERVER_ERROR
        ),
        detail=(
            "Cash-flow readiness could not be checked."
        ),
    ) from error


@cash_flow_router.get(
    "/cash-flow-readiness",
    response_model=(
        CashFlowReadinessResponse
    ),
)
def get_cash_flow_readiness(
    report_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> CashFlowReadinessResponse:
    try:
        return (
            cash_flow_readiness_service
            .calculate_readiness(
                database_session,
                report_id,
            )
        )
    except JournalEntryServiceError as error:
        raise_cash_flow_http_error(
            error,
        )