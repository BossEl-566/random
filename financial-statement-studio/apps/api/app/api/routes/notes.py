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
from app.schemas.notes import (
    DisclosureTemplateCreate,
    DisclosureTemplateInitializationResponse,
    DisclosureTemplateListResponse,
    DisclosureTemplateResponse,
    DisclosureTemplateUpdate,
    FinancialReportNoteCreate,
    FinancialReportNoteListResponse,
    FinancialReportNoteResponse,
    FinancialReportNoteUpdate,
    ReorderFinancialReportNotesRequest,
    ReportNotesInitializationRequest,
    ReportNotesInitializationResponse,
)
from app.services.notes_service import (
    LockedNotesReportError,
    NotesConflictError,
    NotesNotFoundError,
    NotesPersistenceError,
    NotesService,
    NotesServiceError,
    NotesValidationError,
)


notes_router = APIRouter()

notes_service = NotesService()


def raise_notes_http_error(
    error: NotesServiceError,
) -> NoReturn:
    if isinstance(
        error,
        LockedNotesReportError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        NotesNotFoundError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        NotesValidationError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        NotesConflictError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(error),
        ) from error

    if isinstance(
        error,
        NotesPersistenceError,
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
            "The notes operation could not be completed."
        ),
    ) from error


@notes_router.post(
    "/disclosure-templates/initialize",
    response_model=(
        DisclosureTemplateInitializationResponse
    ),
)
def initialize_disclosure_templates(
    database_session: Session = Depends(
        get_db,
    ),
) -> DisclosureTemplateInitializationResponse:
    try:
        return (
            notes_service
            .initialize_system_templates(
                database_session,
            )
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.get(
    "/disclosure-templates",
    response_model=(
        DisclosureTemplateListResponse
    ),
)
def list_disclosure_templates(
    include_inactive: Annotated[
        bool,
        Query(),
    ] = False,
    note_type: Annotated[
        str | None,
        Query(),
    ] = None,
    database_session: Session = Depends(
        get_db,
    ),
) -> DisclosureTemplateListResponse:
    try:
        return notes_service.list_templates(
            database_session,
            include_inactive=(
                include_inactive
            ),
            note_type=note_type,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/disclosure-templates",
    response_model=(
        DisclosureTemplateResponse
    ),
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_disclosure_template(
    payload: DisclosureTemplateCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> DisclosureTemplateResponse:
    try:
        return notes_service.create_template(
            database_session,
            payload,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.patch(
    "/disclosure-templates/{template_id}",
    response_model=(
        DisclosureTemplateResponse
    ),
)
def update_disclosure_template(
    template_id: str,
    payload: DisclosureTemplateUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> DisclosureTemplateResponse:
    try:
        return notes_service.update_template(
            database_session,
            template_id,
            payload,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/disclosure-templates/{template_id}/deactivate",
    response_model=(
        DisclosureTemplateResponse
    ),
)
def deactivate_disclosure_template(
    template_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> DisclosureTemplateResponse:
    try:
        return notes_service.set_template_active(
            database_session,
            template_id,
            False,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/disclosure-templates/{template_id}/reactivate",
    response_model=(
        DisclosureTemplateResponse
    ),
)
def reactivate_disclosure_template(
    template_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> DisclosureTemplateResponse:
    try:
        return notes_service.set_template_active(
            database_session,
            template_id,
            True,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.get(
    "/financial-reports/{report_id}/notes",
    response_model=(
        FinancialReportNoteListResponse
    ),
)
def list_financial_report_notes(
    report_id: str,
    include_inactive: Annotated[
        bool,
        Query(),
    ] = False,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteListResponse:
    try:
        return notes_service.list_notes(
            database_session,
            report_id=report_id,
            include_inactive=(
                include_inactive
            ),
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/financial-reports/{report_id}/notes/initialize",
    response_model=(
        ReportNotesInitializationResponse
    ),
)
def initialize_financial_report_notes(
    report_id: str,
    payload:
        ReportNotesInitializationRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> ReportNotesInitializationResponse:
    try:
        return (
            notes_service
            .initialize_report_notes(
                database_session,
                report_id=report_id,
                payload=payload,
            )
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/financial-reports/{report_id}/notes",
    response_model=(
        FinancialReportNoteResponse
    ),
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_financial_report_note(
    report_id: str,
    payload: FinancialReportNoteCreate,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteResponse:
    try:
        return notes_service.create_note(
            database_session,
            report_id=report_id,
            payload=payload,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.patch(
    "/financial-reports/{report_id}/notes/reorder",
    response_model=(
        FinancialReportNoteListResponse
    ),
)
def reorder_financial_report_notes(
    report_id: str,
    payload:
        ReorderFinancialReportNotesRequest,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteListResponse:
    try:
        return notes_service.reorder_notes(
            database_session,
            report_id=report_id,
            payload=payload,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.get(
    "/financial-report-notes/{note_id}",
    response_model=(
        FinancialReportNoteResponse
    ),
)
def get_financial_report_note(
    note_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteResponse:
    try:
        return notes_service.get_note(
            database_session,
            note_id,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.patch(
    "/financial-report-notes/{note_id}",
    response_model=(
        FinancialReportNoteResponse
    ),
)
def update_financial_report_note(
    note_id: str,
    payload: FinancialReportNoteUpdate,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteResponse:
    try:
        return notes_service.update_note(
            database_session,
            note_id=note_id,
            payload=payload,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/financial-report-notes/{note_id}/deactivate",
    response_model=(
        FinancialReportNoteResponse
    ),
)
def deactivate_financial_report_note(
    note_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteResponse:
    try:
        return notes_service.set_note_active(
            database_session,
            note_id=note_id,
            is_active=False,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)


@notes_router.post(
    "/financial-report-notes/{note_id}/reactivate",
    response_model=(
        FinancialReportNoteResponse
    ),
)
def reactivate_financial_report_note(
    note_id: str,
    database_session: Session = Depends(
        get_db,
    ),
) -> FinancialReportNoteResponse:
    try:
        return notes_service.set_note_active(
            database_session,
            note_id=note_id,
            is_active=True,
        )
    except NotesServiceError as error:
        raise_notes_http_error(error)