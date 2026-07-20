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
from app.schemas.financial_report import (
    FinancialReportCreate,
    FinancialReportListResponse,
    FinancialReportResponse,
    FinancialReportUpdate,
    ReportStatus,
)
from app.services.financial_report_service import (
    EmptyFinancialReportUpdateError,
    FinancialReportCompanyNotFoundError,
    FinancialReportNotFoundError,
    FinancialReportPersistenceError,
    FinancialReportService,
    FinancialReportServiceError,
    InactiveFinancialReportCompanyError,
    InvalidComparisonReportError,
    InvalidFinancialReportPeriodError,
)


router = APIRouter()
financial_report_service = (
    FinancialReportService()
)


def raise_financial_report_http_error(
    error: FinancialReportServiceError,
) -> NoReturn:
    """Convert service errors into HTTP responses."""

    if isinstance(
        error,
        (
            FinancialReportNotFoundError,
            FinancialReportCompanyNotFoundError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        InactiveFinancialReportCompanyError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        (
            InvalidComparisonReportError,
            InvalidFinancialReportPeriodError,
            EmptyFinancialReportUpdateError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        FinancialReportPersistenceError,
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
            "An unexpected financial report error occurred."
        ),
    ) from error


@router.post(
    "",
    response_model=FinancialReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_financial_report(
    payload: FinancialReportCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportResponse:
    """Create a new financial-report document."""

    try:
        financial_report = (
            financial_report_service.create_report(
                database_session,
                payload,
            )
        )
    except FinancialReportServiceError as error:
        raise_financial_report_http_error(
            error,
        )

    return FinancialReportResponse.model_validate(
        financial_report,
    )


@router.get(
    "",
    response_model=FinancialReportListResponse,
)
def list_financial_reports(
    company_id: Annotated[
        str | None,
        Query(
            min_length=36,
            max_length=36,
        ),
    ] = None,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=255,
        ),
    ] = None,
    report_status: Annotated[
        ReportStatus | None,
        Query(alias="status"),
    ] = None,
    include_archived: Annotated[
        bool,
        Query(),
    ] = False,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
        ),
    ] = 50,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportListResponse:
    """List financial reports with filters and pagination."""

    try:
        reports, total = (
            financial_report_service.list_reports(
                database_session,
                company_id=company_id,
                search=search,
                report_status=report_status,
                include_archived=(
                    include_archived
                ),
                offset=offset,
                limit=limit,
            )
        )
    except FinancialReportServiceError as error:
        raise_financial_report_http_error(
            error,
        )

    return FinancialReportListResponse(
        items=[
            FinancialReportResponse.model_validate(
                financial_report,
            )
            for financial_report in reports
        ],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/{report_id}",
    response_model=FinancialReportResponse,
)
def get_financial_report(
    report_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportResponse:
    """Return one financial report."""

    try:
        financial_report = (
            financial_report_service.get_report(
                database_session,
                report_id,
            )
        )
    except FinancialReportServiceError as error:
        raise_financial_report_http_error(
            error,
        )

    return FinancialReportResponse.model_validate(
        financial_report,
    )


@router.patch(
    "/{report_id}",
    response_model=FinancialReportResponse,
)
def update_financial_report(
    report_id: str,
    payload: FinancialReportUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportResponse:
    """Update supplied financial-report fields."""

    try:
        financial_report = (
            financial_report_service.update_report(
                database_session,
                report_id,
                payload,
            )
        )
    except FinancialReportServiceError as error:
        raise_financial_report_http_error(
            error,
        )

    return FinancialReportResponse.model_validate(
        financial_report,
    )