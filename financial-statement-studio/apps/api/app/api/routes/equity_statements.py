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
from app.schemas.equity_statement import (
    StatementOfChangesInEquityResponse,
)
from app.services.equity_statement_service import (
    EquityStatementService,
)
from app.services.journal_entry_service import (
    InvalidJournalPeriodError,
    JournalEntryPersistenceError,
    JournalEntryServiceError,
    JournalReportNotFoundError,
)


equity_statement_router = APIRouter()

equity_statement_service = (
    EquityStatementService()
)


def raise_equity_statement_http_error(
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
            "The Statement of Changes in "
            "Equity could not be calculated."
        ),
    ) from error


@equity_statement_router.get(
    "/statements/changes-in-equity",
    response_model=(
        StatementOfChangesInEquityResponse
    ),
)
def get_statement_of_changes_in_equity(
    report_id: str,
    as_of: Annotated[
        date | None,
        Query(),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> StatementOfChangesInEquityResponse:
    try:
        return (
            equity_statement_service
            .calculate(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )
    except JournalEntryServiceError as error:
        raise_equity_statement_http_error(
            error,
        )