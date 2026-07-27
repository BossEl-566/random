from datetime import date
from typing import (
    Annotated,
    NoReturn,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.tax_configuration import (
    TaxCalculationListResponse,
    TaxCalculationPreviewRequest,
    TaxCalculationPreviewResponse,
    TaxCalculationResponse,
    TaxProfileCreate,
    TaxProfileListResponse,
    TaxProfileResponse,
    TaxProfileUpdate,
    TaxRuleCreate,
    TaxRuleListResponse,
    TaxRuleResponse,
    TaxRuleRetireRequest,
    TaxRuleStatus,
    TaxRuleUpdate,
)
from app.services.tax_configuration_service import (
    TaxConfigurationConflictError,
    TaxConfigurationNotFoundError,
    TaxConfigurationPersistenceError,
    TaxConfigurationService,
    TaxConfigurationServiceError,
    TaxConfigurationValidationError,
)


router = APIRouter()

tax_configuration_service = (
    TaxConfigurationService()
)


def raise_tax_http_error(
    error:
        TaxConfigurationServiceError,
) -> NoReturn:
    if isinstance(
        error,
        TaxConfigurationNotFoundError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        TaxConfigurationValidationError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        TaxConfigurationConflictError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        TaxConfigurationPersistenceError,
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
            "The tax operation could not be completed."
        ),
    ) from error


@router.post(
    "/tax-profiles",
    response_model=TaxProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tax_profile(
    payload: TaxProfileCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileResponse:
    try:
        return (
            tax_configuration_service
            .create_profile(
                database_session,
                payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    "/companies/{company_id}/tax-profiles",
    response_model=TaxProfileListResponse,
)
def list_tax_profiles(
    company_id: str,
    include_inactive: Annotated[
        bool,
        Query(),
    ] = False,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileListResponse:
    try:
        return (
            tax_configuration_service
            .list_profiles(
                database_session,
                company_id=company_id,
                include_inactive=(
                    include_inactive
                ),
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    "/tax-profiles/{profile_id}",
    response_model=TaxProfileResponse,
)
def get_tax_profile(
    profile_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileResponse:
    try:
        return (
            tax_configuration_service
            .get_profile(
                database_session,
                profile_id,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.patch(
    "/tax-profiles/{profile_id}",
    response_model=TaxProfileResponse,
)
def update_tax_profile(
    profile_id: str,
    payload: TaxProfileUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileResponse:
    try:
        return (
            tax_configuration_service
            .update_profile(
                database_session,
                profile_id=profile_id,
                payload=payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    "/tax-profiles/{profile_id}/set-default",
    response_model=TaxProfileResponse,
)
def set_default_tax_profile(
    profile_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileResponse:
    try:
        return (
            tax_configuration_service
            .set_default_profile(
                database_session,
                profile_id,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    "/tax-profiles/{profile_id}/deactivate",
    response_model=TaxProfileResponse,
)
def deactivate_tax_profile(
    profile_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileResponse:
    try:
        return (
            tax_configuration_service
            .set_profile_active(
                database_session,
                profile_id=profile_id,
                is_active=False,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    "/tax-profiles/{profile_id}/reactivate",
    response_model=TaxProfileResponse,
)
def reactivate_tax_profile(
    profile_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxProfileResponse:
    try:
        return (
            tax_configuration_service
            .set_profile_active(
                database_session,
                profile_id=profile_id,
                is_active=True,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    "/tax-profiles/{profile_id}/rules",
    response_model=TaxRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tax_rule(
    profile_id: str,
    payload: TaxRuleCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleResponse:
    try:
        return (
            tax_configuration_service
            .create_rule(
                database_session,
                profile_id=profile_id,
                payload=payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    "/tax-profiles/{profile_id}/rules",
    response_model=TaxRuleListResponse,
)
def list_tax_rules(
    profile_id: str,
    rule_status: Annotated[
        TaxRuleStatus | None,
        Query(alias="status"),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleListResponse:
    try:
        return (
            tax_configuration_service
            .list_rules(
                database_session,
                profile_id=profile_id,
                rule_status=rule_status,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    "/tax-profiles/{profile_id}/rules/effective",
    response_model=TaxRuleResponse,
)
def get_effective_tax_rule(
    profile_id: str,
    rule_code: Annotated[
        str,
        Query(
            min_length=1,
            max_length=100,
        ),
    ],
    calculation_date: Annotated[
        date,
        Query(),
    ],
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleResponse:
    try:
        return (
            tax_configuration_service
            .get_effective_rule(
                database_session,
                profile_id=profile_id,
                rule_code=(
                    rule_code
                    .strip()
                    .upper()
                    .replace(
                        " ",
                        "-",
                    )
                ),
                calculation_date=(
                    calculation_date
                ),
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    "/tax-rules/{rule_id}",
    response_model=TaxRuleResponse,
)
def get_tax_rule(
    rule_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleResponse:
    try:
        return (
            tax_configuration_service
            .get_rule(
                database_session,
                rule_id,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.patch(
    "/tax-rules/{rule_id}",
    response_model=TaxRuleResponse,
)
def update_tax_rule(
    rule_id: str,
    payload: TaxRuleUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleResponse:
    try:
        return (
            tax_configuration_service
            .update_rule(
                database_session,
                rule_id=rule_id,
                payload=payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    "/tax-rules/{rule_id}/activate",
    response_model=TaxRuleResponse,
)
def activate_tax_rule(
    rule_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleResponse:
    try:
        return (
            tax_configuration_service
            .activate_rule(
                database_session,
                rule_id,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    "/tax-rules/{rule_id}/retire",
    response_model=TaxRuleResponse,
)
def retire_tax_rule(
    rule_id: str,
    payload: TaxRuleRetireRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxRuleResponse:
    try:
        return (
            tax_configuration_service
            .retire_rule(
                database_session,
                rule_id=rule_id,
                payload=payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    (
        "/financial-reports/{report_id}"
        "/tax-calculations/preview"
    ),
    response_model=(
        TaxCalculationPreviewResponse
    ),
)
def preview_tax_calculation(
    report_id: str,
    payload:
        TaxCalculationPreviewRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxCalculationPreviewResponse:
    try:
        return (
            tax_configuration_service
            .calculate_preview(
                database_session,
                report_id=report_id,
                payload=payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.post(
    (
        "/financial-reports/{report_id}"
        "/tax-calculations"
    ),
    response_model=TaxCalculationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tax_calculation(
    report_id: str,
    payload:
        TaxCalculationPreviewRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxCalculationResponse:
    try:
        return (
            tax_configuration_service
            .create_calculation(
                database_session,
                report_id=report_id,
                payload=payload,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    (
        "/financial-reports/{report_id}"
        "/tax-calculations"
    ),
    response_model=(
        TaxCalculationListResponse
    ),
)
def list_tax_calculations(
    report_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxCalculationListResponse:
    try:
        return (
            tax_configuration_service
            .list_calculations(
                database_session,
                report_id,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)


@router.get(
    "/tax-calculations/{calculation_id}",
    response_model=TaxCalculationResponse,
)
def get_tax_calculation(
    calculation_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> TaxCalculationResponse:
    try:
        return (
            tax_configuration_service
            .get_calculation(
                database_session,
                calculation_id,
            )
        )
    except TaxConfigurationServiceError as error:
        raise_tax_http_error(error)