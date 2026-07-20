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
from app.schemas.journal_entry import (
    JournalEntryCreate,
    JournalEntryListResponse,
    JournalEntryResponse,
    JournalEntryStatus,
    JournalEntryType,
    JournalEntryUpdate,
    JournalEntryVoid,
    TrialBalanceResponse,
)
from app.services.journal_entry_service import (
    EmptyJournalEntryUpdateError,
    InactiveJournalAccountError,
    InvalidJournalAccountError,
    InvalidJournalEntryStateError,
    InvalidJournalPeriodError,
    JournalAccountNotFoundError,
    JournalEntryNotFoundError,
    JournalEntryPersistenceError,
    JournalEntrySequenceConflictError,
    JournalEntryService,
    JournalEntryServiceError,
    JournalReportNotFoundError,
    LockedJournalReportError,
    UnbalancedJournalEntryError,
)


report_journal_router = APIRouter()
journal_entry_router = APIRouter()

journal_entry_service = JournalEntryService()


def raise_journal_http_error(
    error: JournalEntryServiceError,
) -> NoReturn:
    if isinstance(
        error,
        (
            JournalReportNotFoundError,
            JournalEntryNotFoundError,
            JournalAccountNotFoundError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        (
            LockedJournalReportError,
            InvalidJournalEntryStateError,
            InactiveJournalAccountError,
            JournalEntrySequenceConflictError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        (
            EmptyJournalEntryUpdateError,
            InvalidJournalAccountError,
            InvalidJournalPeriodError,
            UnbalancedJournalEntryError,
        ),
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
            "An unexpected journal-entry error occurred."
        ),
    ) from error


@report_journal_router.post(
    "/journal-entries",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_journal_entry(
    report_id: str,
    payload: JournalEntryCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> JournalEntryResponse:
    try:
        journal_entry = (
            journal_entry_service.create_entry(
                database_session,
                report_id,
                payload,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)

    return JournalEntryResponse.model_validate(
        journal_entry,
    )


@report_journal_router.get(
    "/journal-entries",
    response_model=JournalEntryListResponse,
)
def list_journal_entries(
    report_id: str,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=500,
        ),
    ] = None,
    entry_status: Annotated[
        JournalEntryStatus | None,
        Query(alias="status"),
    ] = None,
    entry_type: Annotated[
        JournalEntryType | None,
        Query(),
    ] = None,
    date_from: Annotated[
        date | None,
        Query(),
    ] = None,
    date_to: Annotated[
        date | None,
        Query(),
    ] = None,
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
) -> JournalEntryListResponse:
    try:
        entries, total = (
            journal_entry_service.list_entries(
                database_session,
                report_id=report_id,
                search=search,
                entry_status=entry_status,
                entry_type=entry_type,
                date_from=date_from,
                date_to=date_to,
                offset=offset,
                limit=limit,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)

    return JournalEntryListResponse(
        items=[
            JournalEntryResponse.model_validate(
                journal_entry,
            )
            for journal_entry in entries
        ],
        total=total,
        offset=offset,
        limit=limit,
    )


@report_journal_router.get(
    "/trial-balance",
    response_model=TrialBalanceResponse,
)
def get_trial_balance(
    report_id: str,
    as_of: Annotated[
        date | None,
        Query(),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> TrialBalanceResponse:
    try:
        return (
            journal_entry_service.calculate_trial_balance(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)


@journal_entry_router.get(
    "/{entry_id}",
    response_model=JournalEntryResponse,
)
def get_journal_entry(
    entry_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> JournalEntryResponse:
    try:
        journal_entry = (
            journal_entry_service.get_entry(
                database_session,
                entry_id,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)

    return JournalEntryResponse.model_validate(
        journal_entry,
    )


@journal_entry_router.patch(
    "/{entry_id}",
    response_model=JournalEntryResponse,
)
def update_journal_entry(
    entry_id: str,
    payload: JournalEntryUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> JournalEntryResponse:
    try:
        journal_entry = (
            journal_entry_service.update_entry(
                database_session,
                entry_id,
                payload,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)

    return JournalEntryResponse.model_validate(
        journal_entry,
    )


@journal_entry_router.post(
    "/{entry_id}/post",
    response_model=JournalEntryResponse,
)
def post_journal_entry(
    entry_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> JournalEntryResponse:
    try:
        journal_entry = (
            journal_entry_service.post_entry(
                database_session,
                entry_id,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)

    return JournalEntryResponse.model_validate(
        journal_entry,
    )


@journal_entry_router.post(
    "/{entry_id}/void",
    response_model=JournalEntryResponse,
)
def void_journal_entry(
    entry_id: str,
    payload: JournalEntryVoid,
    database_session: Session = Depends(
        get_db,
    ),
) -> JournalEntryResponse:
    try:
        journal_entry = (
            journal_entry_service.void_entry(
                database_session,
                entry_id,
                payload,
            )
        )
    except JournalEntryServiceError as error:
        raise_journal_http_error(error)

    return JournalEntryResponse.model_validate(
        journal_entry,
    )