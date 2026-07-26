from typing import NoReturn

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.financial_report import (
    FinancialReportResponse,
)
from app.schemas.report_finalisation import (
    CreateFinancialReportRevisionRequest,
    FinaliseFinancialReportRequest,
    FinaliseFinancialReportResponse,
    FinancialReportVersionListResponse,
    FinancialReportVersionResponse,
    ReportFinalisationReadinessResponse,
)
from app.services.report_finalisation_service import (
    ReportFinalisationConflictError,
    ReportFinalisationNotFoundError,
    ReportFinalisationPersistenceError,
    ReportFinalisationService,
    ReportFinalisationServiceError,
    ReportFinalisationValidationError,
)


router = APIRouter()

report_finalisation_service = (
    ReportFinalisationService()
)


def raise_finalisation_http_error(
    error:
        ReportFinalisationServiceError,
) -> NoReturn:
    if isinstance(
        error,
        ReportFinalisationNotFoundError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        ReportFinalisationValidationError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        ReportFinalisationConflictError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        ReportFinalisationPersistenceError,
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
            "The finalisation operation could not be completed."
        ),
    ) from error


@router.get(
    (
        "/financial-reports/"
        "{report_id}/finalisation-readiness"
    ),
    response_model=(
        ReportFinalisationReadinessResponse
    ),
)
def get_finalisation_readiness(
    report_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> ReportFinalisationReadinessResponse:
    try:
        return (
            report_finalisation_service
            .check_readiness(
                database_session,
                report_id,
            )
        )
    except (
        ReportFinalisationServiceError
    ) as error:
        raise_finalisation_http_error(
            error,
        )


@router.post(
    (
        "/financial-reports/"
        "{report_id}/finalise"
    ),
    response_model=(
        FinaliseFinancialReportResponse
    ),
)
def finalise_financial_report(
    report_id: str,
    payload:
        FinaliseFinancialReportRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinaliseFinancialReportResponse:
    try:
        return (
            report_finalisation_service
            .finalise_report(
                database_session,
                report_id=report_id,
                payload=payload,
            )
        )
    except (
        ReportFinalisationServiceError
    ) as error:
        raise_finalisation_http_error(
            error,
        )


@router.get(
    (
        "/financial-reports/"
        "{report_id}/versions"
    ),
    response_model=(
        FinancialReportVersionListResponse
    ),
)
def list_financial_report_versions(
    report_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportVersionListResponse:
    try:
        return (
            report_finalisation_service
            .list_versions(
                database_session,
                report_id,
            )
        )
    except (
        ReportFinalisationServiceError
    ) as error:
        raise_finalisation_http_error(
            error,
        )


@router.get(
    (
        "/financial-report-versions/"
        "{version_id}"
    ),
    response_model=(
        FinancialReportVersionResponse
    ),
)
def get_financial_report_version(
    version_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportVersionResponse:
    try:
        return (
            report_finalisation_service
            .get_version(
                database_session,
                version_id,
            )
        )
    except (
        ReportFinalisationServiceError
    ) as error:
        raise_finalisation_http_error(
            error,
        )


@router.post(
    (
        "/financial-reports/"
        "{report_id}/revisions"
    ),
    response_model=(
        FinancialReportResponse
    ),
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_financial_report_revision(
    report_id: str,
    payload:
        CreateFinancialReportRevisionRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportResponse:
    try:
        report = (
            report_finalisation_service
            .create_revision(
                database_session,
                report_id=report_id,
                payload=payload,
            )
        )
    except (
        ReportFinalisationServiceError
    ) as error:
        raise_finalisation_http_error(
            error,
        )

    return FinancialReportResponse.model_validate(
        report,
    )