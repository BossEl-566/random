from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


NoteType = Literal[
    "accounting_policy",
    "statement_note",
    "general_disclosure",
]

StatementName = Literal[
    "profit_or_loss",
    "financial_position",
    "cash_flows",
    "changes_in_equity",
]


class DisclosureTemplateCreate(BaseModel):
    template_key: str = Field(
        min_length=1,
        max_length=120,
    )

    title: str = Field(
        min_length=1,
        max_length=255,
    )

    note_type: NoteType = (
        "general_disclosure"
    )

    statement_name: (
        StatementName | None
    ) = None

    statement_line_key: str | None = (
        Field(
            default=None,
            max_length=100,
        )
    )

    default_content: str = ""

    is_required: bool = False
    is_active: bool = True

    display_order: int = Field(
        default=0,
        ge=0,
    )


class DisclosureTemplateUpdate(BaseModel):
    template_key: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    note_type: NoteType | None = None

    statement_name: (
        StatementName | None
    ) = None

    statement_line_key: str | None = (
        Field(
            default=None,
            max_length=100,
        )
    )

    default_content: str | None = None

    is_required: bool | None = None
    is_active: bool | None = None

    display_order: int | None = Field(
        default=None,
        ge=0,
    )


class DisclosureTemplateResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: str

    template_key: str
    title: str
    note_type: str

    statement_name: str | None
    statement_line_key: str | None

    default_content: str

    is_system_template: bool
    is_required: bool
    is_active: bool

    display_order: int

    created_at: datetime
    updated_at: datetime


class DisclosureTemplateListResponse(
    BaseModel,
):
    items: list[
        DisclosureTemplateResponse
    ]

    total: int


class DisclosureTemplateInitializationResponse(
    BaseModel,
):
    created_count: int
    skipped_count: int

    items: list[
        DisclosureTemplateResponse
    ]


class FinancialReportNoteCreate(BaseModel):
    template_id: str | None = None

    note_number: int | None = Field(
        default=None,
        ge=1,
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    note_type: NoteType | None = None

    statement_name: (
        StatementName | None
    ) = None

    statement_line_key: str | None = (
        Field(
            default=None,
            max_length=100,
        )
    )

    content: str | None = None

    is_active: bool = True


class FinancialReportNoteUpdate(BaseModel):
    template_id: str | None = None

    note_number: int | None = Field(
        default=None,
        ge=1,
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    note_type: NoteType | None = None

    statement_name: (
        StatementName | None
    ) = None

    statement_line_key: str | None = (
        Field(
            default=None,
            max_length=100,
        )
    )

    content: str | None = None

    is_active: bool | None = None


class FinancialReportNoteResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: str
    financial_report_id: str
    template_id: str | None

    note_number: int

    title: str
    note_type: str

    statement_name: str | None
    statement_line_key: str | None

    content: str

    is_active: bool

    created_at: datetime
    updated_at: datetime


class FinancialReportNoteListResponse(
    BaseModel,
):
    financial_report_id: str

    items: list[
        FinancialReportNoteResponse
    ]

    total: int


class ReportNotesInitializationRequest(
    BaseModel,
):
    include_optional: bool = True


class ReportNotesInitializationResponse(
    BaseModel,
):
    financial_report_id: str

    created_count: int
    skipped_count: int

    items: list[
        FinancialReportNoteResponse
    ]


class ReorderFinancialReportNotesRequest(
    BaseModel,
):
    note_ids: list[str] = Field(
        min_length=1,
    )