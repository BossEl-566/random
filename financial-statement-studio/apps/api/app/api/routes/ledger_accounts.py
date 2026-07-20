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
from app.schemas.ledger_account import (
    AccountType,
    ChartInitializationResponse,
    LedgerAccountCreate,
    LedgerAccountListResponse,
    LedgerAccountResponse,
    LedgerAccountUpdate,
    ReportCategory,
)
from app.services.ledger_account_service import (
    DuplicateAccountCodeError,
    EmptyLedgerAccountUpdateError,
    InactiveLedgerAccountCompanyError,
    InvalidAccountClassificationError,
    InvalidParentAccountError,
    LedgerAccountCompanyNotFoundError,
    LedgerAccountNotFoundError,
    LedgerAccountPersistenceError,
    LedgerAccountService,
    LedgerAccountServiceError,
    ProtectedSystemAccountError,
)


company_chart_router = APIRouter()
ledger_account_router = APIRouter()

ledger_account_service = LedgerAccountService()


def raise_ledger_account_http_error(
    error: LedgerAccountServiceError,
) -> NoReturn:
    if isinstance(
        error,
        (
            LedgerAccountNotFoundError,
            LedgerAccountCompanyNotFoundError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        (
            DuplicateAccountCodeError,
            InactiveLedgerAccountCompanyError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        (
            EmptyLedgerAccountUpdateError,
            InvalidAccountClassificationError,
            InvalidParentAccountError,
            ProtectedSystemAccountError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        LedgerAccountPersistenceError,
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
            "An unexpected Chart of Accounts error occurred."
        ),
    ) from error


@company_chart_router.post(
    "/initialize",
    response_model=ChartInitializationResponse,
)
def initialize_chart_of_accounts(
    company_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> ChartInitializationResponse:
    try:
        (
            company,
            created_accounts,
            skipped_count,
        ) = ledger_account_service.initialize_chart(
            database_session,
            company_id,
        )
    except LedgerAccountServiceError as error:
        raise_ledger_account_http_error(
            error,
        )

    return ChartInitializationResponse(
        company_id=company.id,
        business_template=company.business_type,
        created_count=len(
            created_accounts,
        ),
        skipped_count=skipped_count,
        items=[
            LedgerAccountResponse.model_validate(
                account,
            )
            for account in created_accounts
        ],
    )


@company_chart_router.get(
    "",
    response_model=LedgerAccountListResponse,
)
def list_chart_of_accounts(
    company_id: str,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=180,
        ),
    ] = None,
    account_type: Annotated[
        AccountType | None,
        Query(),
    ] = None,
    report_category: Annotated[
        ReportCategory | None,
        Query(),
    ] = None,
    include_inactive: Annotated[
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
            le=500,
        ),
    ] = 100,
    database_session: Session = Depends(
        get_db,
    ),
) -> LedgerAccountListResponse:
    try:
        accounts, total = (
            ledger_account_service.list_accounts(
                database_session,
                company_id=company_id,
                search=search,
                account_type=account_type,
                report_category=(
                    report_category
                ),
                include_inactive=(
                    include_inactive
                ),
                offset=offset,
                limit=limit,
            )
        )
    except LedgerAccountServiceError as error:
        raise_ledger_account_http_error(
            error,
        )

    return LedgerAccountListResponse(
        items=[
            LedgerAccountResponse.model_validate(
                account,
            )
            for account in accounts
        ],
        total=total,
        offset=offset,
        limit=limit,
    )


@company_chart_router.post(
    "",
    response_model=LedgerAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ledger_account(
    company_id: str,
    payload: LedgerAccountCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> LedgerAccountResponse:
    try:
        account = (
            ledger_account_service.create_account(
                database_session,
                company_id,
                payload,
            )
        )
    except LedgerAccountServiceError as error:
        raise_ledger_account_http_error(
            error,
        )

    return LedgerAccountResponse.model_validate(
        account,
    )


@ledger_account_router.patch(
    "/{account_id}",
    response_model=LedgerAccountResponse,
)
def update_ledger_account(
    account_id: str,
    payload: LedgerAccountUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> LedgerAccountResponse:
    try:
        account = (
            ledger_account_service.update_account(
                database_session,
                account_id,
                payload,
            )
        )
    except LedgerAccountServiceError as error:
        raise_ledger_account_http_error(
            error,
        )

    return LedgerAccountResponse.model_validate(
        account,
    )


@ledger_account_router.patch(
    "/{account_id}/deactivate",
    response_model=LedgerAccountResponse,
)
def deactivate_ledger_account(
    account_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> LedgerAccountResponse:
    try:
        account = (
            ledger_account_service.deactivate_account(
                database_session,
                account_id,
            )
        )
    except LedgerAccountServiceError as error:
        raise_ledger_account_http_error(
            error,
        )

    return LedgerAccountResponse.model_validate(
        account,
    )