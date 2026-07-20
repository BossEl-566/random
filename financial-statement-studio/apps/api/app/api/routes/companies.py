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
from app.schemas.company import (
    CompanyCreate,
    CompanyListResponse,
    CompanyResponse,
    CompanyUpdate,
)
from app.services.company_service import (
    CompanyNotFoundError,
    CompanyPersistenceError,
    CompanyService,
    CompanyServiceError,
    EmptyCompanyUpdateError,
)


router = APIRouter()
company_service = CompanyService()


def raise_company_http_error(
    error: CompanyServiceError,
) -> NoReturn:
    """Convert service exceptions into appropriate HTTP responses."""

    if isinstance(
        error,
        CompanyNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        EmptyCompanyUpdateError,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        CompanyPersistenceError,
    ):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        ) from error

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected company error occurred.",
    ) from error


@router.post(
    "",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_company(
    payload: CompanyCreate,
    database_session: Session = Depends(get_db),
) -> CompanyResponse:
    """Create and save a new company."""

    try:
        company = company_service.create_company(
            database_session,
            payload,
        )
    except CompanyServiceError as error:
        raise_company_http_error(error)

    return CompanyResponse.model_validate(
        company,
    )


@router.get(
    "",
    response_model=CompanyListResponse,
)
def list_companies(
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=180,
        ),
    ] = None,
    include_inactive: Annotated[
        bool,
        Query(),
    ] = False,
    offset: Annotated[
        int,
        Query(
            ge=0,
        ),
    ] = 0,
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
        ),
    ] = 50,
    database_session: Session = Depends(get_db),
) -> CompanyListResponse:
    """Return active companies with search and pagination support."""

    try:
        companies, total = company_service.list_companies(
            database_session,
            search=search,
            include_inactive=include_inactive,
            offset=offset,
            limit=limit,
        )
    except CompanyServiceError as error:
        raise_company_http_error(error)

    return CompanyListResponse(
        items=[
            CompanyResponse.model_validate(
                company,
            )
            for company in companies
        ],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
)
def get_company(
    company_id: str,
    database_session: Session = Depends(get_db),
) -> CompanyResponse:
    """Return one company by its identifier."""

    try:
        company = company_service.get_company(
            database_session,
            company_id,
        )
    except CompanyServiceError as error:
        raise_company_http_error(error)

    return CompanyResponse.model_validate(
        company,
    )


@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
)
def update_company(
    company_id: str,
    payload: CompanyUpdate,
    database_session: Session = Depends(get_db),
) -> CompanyResponse:
    """Update only the supplied company fields."""

    try:
        company = company_service.update_company(
            database_session,
            company_id,
            payload,
        )
    except CompanyServiceError as error:
        raise_company_http_error(error)

    return CompanyResponse.model_validate(
        company,
    )


@router.patch(
    "/{company_id}/deactivate",
    response_model=CompanyResponse,
)
def deactivate_company(
    company_id: str,
    database_session: Session = Depends(get_db),
) -> CompanyResponse:
    """
    Soft-deactivate a company without deleting its historical data.
    """

    try:
        company = company_service.deactivate_company(
            database_session,
            company_id,
        )
    except CompanyServiceError as error:
        raise_company_http_error(error)

    return CompanyResponse.model_validate(
        company,
    )