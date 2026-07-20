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
from app.schemas.financial_statement import (
    ProfitOrLossResponse,
    StatementOfFinancialPositionResponse,
)
from app.services.financial_statement_service import (
    FinancialStatementService,
)
from app.services.journal_entry_service import (
    InvalidJournalPeriodError,
    JournalEntryPersistenceError,
    JournalEntryServiceError,
    JournalReportNotFoundError,
)


financial_statement_router = APIRouter()

financial_statement_service = (
    FinancialStatementService()
)


def raise_financial_statement_http_error(
    error: JournalEntryServiceError,
) -> NoReturn:
    if isinstance(
        error,
        JournalReportNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        InvalidJournalPeriodError,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
            "The financial statement could not be calculated."
        ),
    ) from error


@financial_statement_router.get(
    "/profit-or-loss",
    response_model=ProfitOrLossResponse,
)
def get_profit_or_loss_statement(
    report_id: str,
    as_of: Annotated[
        date | None,
        Query(),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> ProfitOrLossResponse:
    try:
        return (
            financial_statement_service.calculate_profit_or_loss(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )
    except JournalEntryServiceError as error:
        raise_financial_statement_http_error(
            error,
        )


@financial_statement_router.get(
    "/financial-position",
    response_model=(
        StatementOfFinancialPositionResponse
    ),
)
def get_statement_of_financial_position(
    report_id: str,
    as_of: Annotated[
        date | None,
        Query(),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> StatementOfFinancialPositionResponse:
    try:
        return (
            financial_statement_service.calculate_statement_of_financial_position(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )
    except JournalEntryServiceError as error:
        raise_financial_statement_http_error(
            error,
        )