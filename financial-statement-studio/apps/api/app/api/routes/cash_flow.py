from datetime import date
from typing import Annotated, NoReturn

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.cash_flow import (
    CashFlowReadinessResponse,
    StatementOfCashFlowsResponse,
)
from app.services.cash_flow_readiness_service import (
    CashFlowReadinessService,
)
from app.services.cash_flow_statement_service import (
    CashFlowNotReadyError,
    CashFlowStatementService,
)
from app.services.journal_entry_service import (
    InvalidJournalPeriodError,
    JournalEntryPersistenceError,
    JournalEntryServiceError,
    JournalReportNotFoundError,
)


cash_flow_router = APIRouter()

cash_flow_readiness_service = (
    CashFlowReadinessService()
)

cash_flow_statement_service = (
    CashFlowStatementService()
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
        InvalidJournalPeriodError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        CashFlowNotReadyError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
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
            "The Statement of Cash Flows could not be calculated."
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


@cash_flow_router.get(
    "/statements/cash-flows",
    response_model=(
        StatementOfCashFlowsResponse
    ),
)
def get_statement_of_cash_flows(
    report_id: str,
    as_of: Annotated[
        date | None,
        Query(),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> StatementOfCashFlowsResponse:
    try:
        return (
            cash_flow_statement_service
            .calculate(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )
    except JournalEntryServiceError as error:
        raise_cash_flow_http_error(
            error,
        )