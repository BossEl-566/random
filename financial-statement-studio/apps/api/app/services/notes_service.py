from collections.abc import Iterable

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)
from sqlalchemy.orm import Session

from app.models.disclosure_template import (
    DisclosureTemplate,
)
from app.models.financial_report_note import (
    FinancialReportNote,
)
from app.repositories.notes_repository import (
    NotesRepository,
)
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


class NotesServiceError(Exception):
    """Base exception for notes operations."""


class NotesNotFoundError(
    NotesServiceError,
):
    """A requested report, note or template was not found."""


class NotesValidationError(
    NotesServiceError,
):
    """Submitted notes data is invalid."""


class NotesConflictError(
    NotesServiceError,
):
    """Submitted data conflicts with existing data."""


class NotesPersistenceError(
    NotesServiceError,
):
    """The notes operation could not be persisted."""


SYSTEM_DISCLOSURE_TEMPLATES = [
    {
        "template_key":
            "basis-of-preparation",
        "title":
            "Basis of Preparation",
        "note_type":
            "accounting_policy",
        "statement_name":
            None,
        "statement_line_key":
            None,
        "default_content": (
            "These financial statements have been "
            "prepared using the accrual basis of "
            "accounting and the historical-cost "
            "convention, except where otherwise stated."
        ),
        "is_required": True,
        "display_order": 10,
    },
    {
        "template_key":
            "going-concern",
        "title":
            "Going Concern",
        "note_type":
            "general_disclosure",
        "statement_name":
            None,
        "statement_line_key":
            None,
        "default_content": (
            "Management has assessed the entity's "
            "ability to continue as a going concern "
            "and considers the going-concern basis "
            "appropriate for preparing these statements."
        ),
        "is_required": True,
        "display_order": 20,
    },
    {
        "template_key":
            "revenue-recognition",
        "title":
            "Revenue Recognition",
        "note_type":
            "accounting_policy",
        "statement_name":
            "profit_or_loss",
        "statement_line_key":
            "revenue",
        "default_content": (
            "Revenue is recognised when the entity "
            "satisfies its performance obligations "
            "and the amount can be measured reliably."
        ),
        "is_required": True,
        "display_order": 30,
    },
    {
        "template_key":
            "property-plant-equipment",
        "title":
            "Property, Plant and Equipment",
        "note_type":
            "accounting_policy",
        "statement_name":
            "financial_position",
        "statement_line_key":
            "non_current_assets",
        "default_content": (
            "Property, plant and equipment are carried "
            "at cost less accumulated depreciation and "
            "accumulated impairment losses."
        ),
        "is_required": False,
        "display_order": 40,
    },
    {
        "template_key":
            "inventories",
        "title":
            "Inventories",
        "note_type":
            "accounting_policy",
        "statement_name":
            "financial_position",
        "statement_line_key":
            "inventories",
        "default_content": (
            "Inventories are measured at the lower of "
            "cost and estimated net realisable value."
        ),
        "is_required": False,
        "display_order": 50,
    },
    {
        "template_key":
            "cash-equivalents",
        "title":
            "Cash and Cash Equivalents",
        "note_type":
            "accounting_policy",
        "statement_name":
            "cash_flows",
        "statement_line_key":
            "cash_and_cash_equivalents",
        "default_content": (
            "Cash and cash equivalents comprise cash "
            "on hand, bank balances and qualifying "
            "short-term highly liquid investments."
        ),
        "is_required": True,
        "display_order": 60,
    },
    {
        "template_key":
            "trade-receivables",
        "title":
            "Trade and Other Receivables",
        "note_type":
            "statement_note",
        "statement_name":
            "financial_position",
        "statement_line_key":
            "current_assets",
        "default_content": (
            "Trade and other receivables represent "
            "amounts due from customers and other parties "
            "at the reporting date."
        ),
        "is_required": False,
        "display_order": 70,
    },
    {
        "template_key":
            "trade-payables",
        "title":
            "Trade and Other Payables",
        "note_type":
            "statement_note",
        "statement_name":
            "financial_position",
        "statement_line_key":
            "current_liabilities",
        "default_content": (
            "Trade and other payables represent amounts "
            "owed to suppliers and other parties at the "
            "reporting date."
        ),
        "is_required": False,
        "display_order": 80,
    },
    {
        "template_key":
            "taxation",
        "title":
            "Taxation",
        "note_type":
            "statement_note",
        "statement_name":
            "profit_or_loss",
        "statement_line_key":
            "taxation",
        "default_content": (
            "Taxation includes current tax recognised "
            "for the reporting period based on applicable "
            "tax legislation and assessed taxable profit."
        ),
        "is_required": False,
        "display_order": 90,
    },
    {
        "template_key":
            "equity",
        "title":
            "Capital and Equity",
        "note_type":
            "statement_note",
        "statement_name":
            "changes_in_equity",
        "statement_line_key":
            "equity",
        "default_content": (
            "Equity comprises owner contributions, "
            "accumulated results, reserves and other "
            "direct movements recognised in equity."
        ),
        "is_required": True,
        "display_order": 100,
    },
    {
        "template_key":
            "events-after-reporting-period",
        "title":
            "Events After the Reporting Period",
        "note_type":
            "general_disclosure",
        "statement_name":
            None,
        "statement_line_key":
            None,
        "default_content": (
            "Management has considered events occurring "
            "after the reporting date and before the "
            "financial statements were authorised."
        ),
        "is_required": False,
        "display_order": 110,
    },
]


class NotesService:
    def __init__(
        self,
        repository: NotesRepository
        | None = None,
    ) -> None:
        self.repository = (
            repository
            or NotesRepository()
        )

    def clean_required_text(
        self,
        value: str | None,
        field_name: str,
    ) -> str:
        cleaned = (
            value.strip()
            if value is not None
            else ""
        )

        if not cleaned:
            raise NotesValidationError(
                f"{field_name} is required.",
            )

        return cleaned

    def clean_optional_text(
        self,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None

    def validate_cross_reference(
        self,
        *,
        note_type: str,
        statement_name: str | None,
        statement_line_key: str | None,
    ) -> None:
        if (
            statement_line_key
            and not statement_name
        ):
            raise NotesValidationError(
                "A statement line reference requires a statement name.",
            )

        if (
            note_type == "statement_note"
            and not statement_name
        ):
            raise NotesValidationError(
                "A statement note must reference a financial statement.",
            )

    def commit(
        self,
        database_session: Session,
        conflict_message: str,
    ) -> None:
        try:
            database_session.commit()
        except IntegrityError as error:
            database_session.rollback()

            raise NotesConflictError(
                conflict_message,
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise NotesPersistenceError(
                "The notes operation could not be saved.",
            ) from error

    def require_report(
        self,
        database_session: Session,
        report_id: str,
    ):
        report = (
            self.repository
            .get_financial_report(
                database_session,
                report_id,
            )
        )

        if report is None:
            raise NotesNotFoundError(
                "Financial report was not found.",
            )

        return report

    def require_template(
        self,
        database_session: Session,
        template_id: str,
    ) -> DisclosureTemplate:
        template = (
            self.repository.get_template(
                database_session,
                template_id,
            )
        )

        if template is None:
            raise NotesNotFoundError(
                "Disclosure template was not found.",
            )

        return template

    def require_note(
        self,
        database_session: Session,
        note_id: str,
    ) -> FinancialReportNote:
        note = self.repository.get_note(
            database_session,
            note_id,
        )

        if note is None:
            raise NotesNotFoundError(
                "Financial report note was not found.",
            )

        return note

    def template_response(
        self,
        template: DisclosureTemplate,
    ) -> DisclosureTemplateResponse:
        return DisclosureTemplateResponse.model_validate(
            template,
        )

    def note_response(
        self,
        note: FinancialReportNote,
    ) -> FinancialReportNoteResponse:
        return FinancialReportNoteResponse.model_validate(
            note,
        )

    def initialize_system_templates(
        self,
        database_session: Session,
    ) -> DisclosureTemplateInitializationResponse:
        created_count = 0
        skipped_count = 0

        for definition in (
            SYSTEM_DISCLOSURE_TEMPLATES
        ):
            existing = (
                self.repository
                .get_template_by_key(
                    database_session,
                    definition[
                        "template_key"
                    ],
                )
            )

            if existing is not None:
                skipped_count += 1
                continue

            template = DisclosureTemplate(
                **definition,
                is_system_template=True,
                is_active=True,
            )

            database_session.add(
                template,
            )

            created_count += 1

        self.commit(
            database_session,
            (
                "One or more system template "
                "keys already exist."
            ),
        )

        templates = (
            self.repository.list_templates(
                database_session,
                include_inactive=True,
                note_type=None,
            )
        )

        return (
            DisclosureTemplateInitializationResponse(
                created_count=created_count,
                skipped_count=skipped_count,
                items=[
                    self.template_response(
                        template,
                    )
                    for template
                    in templates
                ],
            )
        )

    def list_templates(
        self,
        database_session: Session,
        *,
        include_inactive: bool,
        note_type: str | None,
    ) -> DisclosureTemplateListResponse:
        templates = (
            self.repository.list_templates(
                database_session,
                include_inactive=(
                    include_inactive
                ),
                note_type=note_type,
            )
        )

        return DisclosureTemplateListResponse(
            items=[
                self.template_response(
                    template,
                )
                for template in templates
            ],
            total=len(templates),
        )

    def create_template(
        self,
        database_session: Session,
        payload: DisclosureTemplateCreate,
    ) -> DisclosureTemplateResponse:
        template_key = (
            self.clean_required_text(
                payload.template_key,
                "Template key",
            )
        )

        title = self.clean_required_text(
            payload.title,
            "Template title",
        )

        statement_name = (
            self.clean_optional_text(
                payload.statement_name,
            )
        )

        statement_line_key = (
            self.clean_optional_text(
                payload.statement_line_key,
            )
        )

        self.validate_cross_reference(
            note_type=payload.note_type,
            statement_name=statement_name,
            statement_line_key=(
                statement_line_key
            ),
        )

        template = DisclosureTemplate(
            template_key=template_key,
            title=title,
            note_type=payload.note_type,
            statement_name=statement_name,
            statement_line_key=(
                statement_line_key
            ),
            default_content=(
                payload.default_content.strip()
            ),
            is_system_template=False,
            is_required=payload.is_required,
            is_active=payload.is_active,
            display_order=(
                payload.display_order
            ),
        )

        database_session.add(
            template,
        )

        self.commit(
            database_session,
            "Template key already exists.",
        )

        database_session.refresh(
            template,
        )

        return self.template_response(
            template,
        )

    def update_template(
        self,
        database_session: Session,
        template_id: str,
        payload: DisclosureTemplateUpdate,
    ) -> DisclosureTemplateResponse:
        template = self.require_template(
            database_session,
            template_id,
        )

        update_data = payload.model_dump(
            exclude_unset=True,
        )

        if not update_data:
            return self.template_response(
                template,
            )

        if "template_key" in update_data:
            template.template_key = (
                self.clean_required_text(
                    update_data[
                        "template_key"
                    ],
                    "Template key",
                )
            )

        if "title" in update_data:
            template.title = (
                self.clean_required_text(
                    update_data["title"],
                    "Template title",
                )
            )

        if "note_type" in update_data:
            template.note_type = (
                update_data["note_type"]
            )

        if "statement_name" in update_data:
            template.statement_name = (
                self.clean_optional_text(
                    update_data[
                        "statement_name"
                    ],
                )
            )

        if (
            "statement_line_key"
            in update_data
        ):
            template.statement_line_key = (
                self.clean_optional_text(
                    update_data[
                        "statement_line_key"
                    ],
                )
            )

        if (
            "default_content"
            in update_data
        ):
            template.default_content = (
                update_data[
                    "default_content"
                ].strip()
            )

        if "is_required" in update_data:
            template.is_required = (
                update_data["is_required"]
            )

        if "is_active" in update_data:
            template.is_active = (
                update_data["is_active"]
            )

        if "display_order" in update_data:
            template.display_order = (
                update_data[
                    "display_order"
                ]
            )

        self.validate_cross_reference(
            note_type=template.note_type,
            statement_name=(
                template.statement_name
            ),
            statement_line_key=(
                template.statement_line_key
            ),
        )

        self.commit(
            database_session,
            "Template key already exists.",
        )

        database_session.refresh(
            template,
        )

        return self.template_response(
            template,
        )

    def set_template_active(
        self,
        database_session: Session,
        template_id: str,
        is_active: bool,
    ) -> DisclosureTemplateResponse:
        template = self.require_template(
            database_session,
            template_id,
        )

        template.is_active = is_active

        self.commit(
            database_session,
            "Template status could not be updated.",
        )

        database_session.refresh(
            template,
        )

        return self.template_response(
            template,
        )

    def list_notes(
        self,
        database_session: Session,
        *,
        report_id: str,
        include_inactive: bool,
    ) -> FinancialReportNoteListResponse:
        self.require_report(
            database_session,
            report_id,
        )

        notes = self.repository.list_notes(
            database_session,
            report_id=report_id,
            include_inactive=(
                include_inactive
            ),
        )

        return FinancialReportNoteListResponse(
            financial_report_id=(
                report_id
            ),
            items=[
                self.note_response(note)
                for note in notes
            ],
            total=len(notes),
        )

    def merge_create_values(
        self,
        database_session: Session,
        payload: FinancialReportNoteCreate,
    ) -> dict[str, object]:
        template = None

        if payload.template_id:
            template = self.require_template(
                database_session,
                payload.template_id,
            )

            if not template.is_active:
                raise NotesValidationError(
                    "Inactive templates cannot be used to create notes.",
                )

        fields_set = payload.model_fields_set

        title = (
            payload.title
            if "title" in fields_set
            else (
                template.title
                if template
                else None
            )
        )

        note_type = (
            payload.note_type
            if "note_type" in fields_set
            else (
                template.note_type
                if template
                else (
                    "general_disclosure"
                )
            )
        )

        statement_name = (
            payload.statement_name
            if "statement_name"
            in fields_set
            else (
                template.statement_name
                if template
                else None
            )
        )

        statement_line_key = (
            payload.statement_line_key
            if "statement_line_key"
            in fields_set
            else (
                template.statement_line_key
                if template
                else None
            )
        )

        content = (
            payload.content
            if "content" in fields_set
            else (
                template.default_content
                if template
                else ""
            )
        )

        clean_title = (
            self.clean_required_text(
                title,
                "Note title",
            )
        )

        clean_statement_name = (
            self.clean_optional_text(
                statement_name,
            )
        )

        clean_statement_line_key = (
            self.clean_optional_text(
                statement_line_key,
            )
        )

        self.validate_cross_reference(
            note_type=note_type,
            statement_name=(
                clean_statement_name
            ),
            statement_line_key=(
                clean_statement_line_key
            ),
        )

        return {
            "template_id": (
                template.id
                if template
                else None
            ),
            "title": clean_title,
            "note_type": note_type,
            "statement_name": (
                clean_statement_name
            ),
            "statement_line_key": (
                clean_statement_line_key
            ),
            "content": (
                content.strip()
                if content is not None
                else ""
            ),
            "is_active": (
                payload.is_active
            ),
        }

    def renumber_notes(
        self,
        database_session: Session,
        *,
        report_id: str,
        active_order_ids: (
            Iterable[str] | None
        ) = None,
    ) -> None:
        notes = self.repository.list_notes(
            database_session,
            report_id=report_id,
            include_inactive=True,
        )

        active_notes = [
            note
            for note in notes
            if note.is_active
        ]

        inactive_notes = [
            note
            for note in notes
            if not note.is_active
        ]

        if active_order_ids is not None:
            ordered_ids = list(
                active_order_ids,
            )

            active_by_id = {
                note.id: note
                for note in active_notes
            }

            if (
                len(ordered_ids)
                != len(set(ordered_ids))
            ):
                raise NotesValidationError(
                    "A note cannot appear more than once in the reorder request.",
                )

            if set(ordered_ids) != set(
                active_by_id,
            ):
                raise NotesValidationError(
                    "The reorder request must contain every active note exactly once.",
                )

            active_notes = [
                active_by_id[note_id]
                for note_id
                in ordered_ids
            ]

        inactive_notes.sort(
            key=lambda note: (
                note.note_number,
                note.created_at,
            ),
        )

        ordered_notes = (
            active_notes
            + inactive_notes
        )

        temporary_start = (
            max(
                (
                    note.note_number
                    for note in notes
                ),
                default=0,
            )
            + len(notes)
            + 1000
        )

        for index, note in enumerate(
            ordered_notes,
            start=1,
        ):
            note.note_number = (
                temporary_start
                + index
            )

        database_session.flush()

        for index, note in enumerate(
            ordered_notes,
            start=1,
        ):
            note.note_number = index

        database_session.flush()

    def create_note(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload: FinancialReportNoteCreate,
    ) -> FinancialReportNoteResponse:
        self.require_report(
            database_session,
            report_id,
        )

        values = self.merge_create_values(
            database_session,
            payload,
        )

        note = FinancialReportNote(
            financial_report_id=report_id,
            note_number=(
                self.repository
                .max_note_number(
                    database_session,
                    report_id,
                )
                + 1
            ),
            **values,
        )

        database_session.add(note)

        try:
            database_session.flush()

            active_notes = (
                self.repository.list_notes(
                    database_session,
                    report_id=report_id,
                    include_inactive=False,
                )
            )

            active_order = [
                current_note.id
                for current_note
                in active_notes
                if current_note.id
                != note.id
            ]

            desired_number = (
                payload.note_number
                or len(active_order)
                + 1
            )

            insertion_index = min(
                max(
                    desired_number - 1,
                    0,
                ),
                len(active_order),
            )

            active_order.insert(
                insertion_index,
                note.id,
            )

            self.renumber_notes(
                database_session,
                report_id=report_id,
                active_order_ids=(
                    active_order
                ),
            )

            database_session.commit()
        except NotesServiceError:
            database_session.rollback()
            raise
        except IntegrityError as error:
            database_session.rollback()

            raise NotesConflictError(
                "The requested note number conflicts with another note.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise NotesPersistenceError(
                "The report note could not be created.",
            ) from error

        database_session.refresh(
            note,
        )

        return self.note_response(note)

    def initialize_report_notes(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            ReportNotesInitializationRequest,
    ) -> ReportNotesInitializationResponse:
        self.require_report(
            database_session,
            report_id,
        )

        templates = (
            self.repository.list_templates(
                database_session,
                include_inactive=False,
                note_type=None,
            )
        )

        if not payload.include_optional:
            templates = [
                template
                for template in templates
                if template.is_required
            ]

        existing_notes = (
            self.repository.list_notes(
                database_session,
                report_id=report_id,
                include_inactive=True,
            )
        )

        existing_template_ids = {
            note.template_id
            for note in existing_notes
            if note.template_id
        }

        created_count = 0
        skipped_count = 0

        next_number = (
            self.repository.max_note_number(
                database_session,
                report_id,
            )
            + 1
        )

        for template in templates:
            if (
                template.id
                in existing_template_ids
            ):
                skipped_count += 1
                continue

            database_session.add(
                FinancialReportNote(
                    financial_report_id=(
                        report_id
                    ),
                    template_id=template.id,
                    note_number=(
                        next_number
                    ),
                    title=template.title,
                    note_type=(
                        template.note_type
                    ),
                    statement_name=(
                        template.statement_name
                    ),
                    statement_line_key=(
                        template
                        .statement_line_key
                    ),
                    content=(
                        template.default_content
                    ),
                    is_active=True,
                ),
            )

            next_number += 1
            created_count += 1

        try:
            database_session.flush()

            self.renumber_notes(
                database_session,
                report_id=report_id,
            )

            database_session.commit()
        except IntegrityError as error:
            database_session.rollback()

            raise NotesConflictError(
                "Report notes could not be initialized because note numbering conflicts.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise NotesPersistenceError(
                "Report notes could not be initialized.",
            ) from error

        notes = self.repository.list_notes(
            database_session,
            report_id=report_id,
            include_inactive=False,
        )

        return ReportNotesInitializationResponse(
            financial_report_id=(
                report_id
            ),
            created_count=created_count,
            skipped_count=skipped_count,
            items=[
                self.note_response(note)
                for note in notes
            ],
        )

    def get_note(
        self,
        database_session: Session,
        note_id: str,
    ) -> FinancialReportNoteResponse:
        note = self.require_note(
            database_session,
            note_id,
        )

        return self.note_response(note)

    def update_note(
        self,
        database_session: Session,
        *,
        note_id: str,
        payload: FinancialReportNoteUpdate,
    ) -> FinancialReportNoteResponse:
        note = self.require_note(
            database_session,
            note_id,
        )

        update_data = payload.model_dump(
            exclude_unset=True,
        )

        requested_note_number = (
            update_data.pop(
                "note_number",
                None,
            )
        )

        if "template_id" in update_data:
            template_id = update_data[
                "template_id"
            ]

            if template_id is None:
                note.template_id = None
            else:
                template = (
                    self.require_template(
                        database_session,
                        template_id,
                    )
                )

                if not template.is_active:
                    raise NotesValidationError(
                        "Inactive templates cannot be assigned to notes.",
                    )

                note.template_id = (
                    template.id
                )

        if "title" in update_data:
            note.title = (
                self.clean_required_text(
                    update_data["title"],
                    "Note title",
                )
            )

        if "note_type" in update_data:
            note.note_type = (
                update_data["note_type"]
            )

        if "statement_name" in update_data:
            note.statement_name = (
                self.clean_optional_text(
                    update_data[
                        "statement_name"
                    ],
                )
            )

        if (
            "statement_line_key"
            in update_data
        ):
            note.statement_line_key = (
                self.clean_optional_text(
                    update_data[
                        "statement_line_key"
                    ],
                )
            )

        if "content" in update_data:
            note.content = (
                update_data["content"]
                or ""
            ).strip()

        if "is_active" in update_data:
            note.is_active = (
                update_data["is_active"]
            )

        self.validate_cross_reference(
            note_type=note.note_type,
            statement_name=(
                note.statement_name
            ),
            statement_line_key=(
                note.statement_line_key
            ),
        )

        try:
            database_session.flush()

            active_notes = (
                self.repository.list_notes(
                    database_session,
                    report_id=(
                        note.financial_report_id
                    ),
                    include_inactive=False,
                )
            )

            active_order = [
                current_note.id
                for current_note
                in active_notes
            ]

            if (
                note.is_active
                and requested_note_number
                is not None
            ):
                active_order = [
                    current_note_id
                    for current_note_id
                    in active_order
                    if current_note_id
                    != note.id
                ]

                insertion_index = min(
                    max(
                        requested_note_number
                        - 1,
                        0,
                    ),
                    len(active_order),
                )

                active_order.insert(
                    insertion_index,
                    note.id,
                )

            self.renumber_notes(
                database_session,
                report_id=(
                    note.financial_report_id
                ),
                active_order_ids=(
                    active_order
                    if note.is_active
                    else None
                ),
            )

            database_session.commit()
        except NotesServiceError:
            database_session.rollback()
            raise
        except IntegrityError as error:
            database_session.rollback()

            raise NotesConflictError(
                "The note update conflicts with another note.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise NotesPersistenceError(
                "The report note could not be updated.",
            ) from error

        database_session.refresh(note)

        return self.note_response(note)

    def set_note_active(
        self,
        database_session: Session,
        *,
        note_id: str,
        is_active: bool,
    ) -> FinancialReportNoteResponse:
        note = self.require_note(
            database_session,
            note_id,
        )

        note.is_active = is_active

        if is_active:
            note.note_number = (
                self.repository
                .max_note_number(
                    database_session,
                    note.financial_report_id,
                )
                + 1
            )

        try:
            database_session.flush()

            self.renumber_notes(
                database_session,
                report_id=(
                    note.financial_report_id
                ),
            )

            database_session.commit()
        except IntegrityError as error:
            database_session.rollback()

            raise NotesConflictError(
                "The note status could not be updated because of a numbering conflict.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise NotesPersistenceError(
                "The note status could not be updated.",
            ) from error

        database_session.refresh(note)

        return self.note_response(note)

    def reorder_notes(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            ReorderFinancialReportNotesRequest,
    ) -> FinancialReportNoteListResponse:
        self.require_report(
            database_session,
            report_id,
        )

        try:
            self.renumber_notes(
                database_session,
                report_id=report_id,
                active_order_ids=(
                    payload.note_ids
                ),
            )

            database_session.commit()
        except NotesServiceError:
            database_session.rollback()
            raise
        except IntegrityError as error:
            database_session.rollback()

            raise NotesConflictError(
                "The notes could not be reordered because of a numbering conflict.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise NotesPersistenceError(
                "The report notes could not be reordered.",
            ) from error

        return self.list_notes(
            database_session,
            report_id=report_id,
            include_inactive=False,
        )