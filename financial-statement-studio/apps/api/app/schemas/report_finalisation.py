from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class FinalisationCheck(BaseModel):
    code: str
    title: str
    detail: str


class ReportFinalisationReadinessResponse(
    BaseModel,
):
    financial_report_id: str
    report_status: str

    can_finalise: bool

    posted_entry_count: int
    draft_entry_count: int
    active_note_count: int

    trial_balance_is_balanced: bool

    blockers: list[FinalisationCheck]
    warnings: list[FinalisationCheck]

    checked_at: datetime


class FinaliseFinancialReportRequest(
    BaseModel,
):
    accountant_name: str = Field(
        min_length=1,
        max_length=180,
    )

    finalised_by: str = Field(
        min_length=1,
        max_length=180,
    )

    approval_notes: str | None = Field(
        default=None,
        max_length=20000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )


class FinancialReportVersionSummary(
    BaseModel,
):
    id: str
    financial_report_id: str

    revision_series_id: str
    revision_number: int

    finalised_at: datetime
    finalised_by: str
    accountant_name: str

    snapshot_checksum: str

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class FinancialReportVersionResponse(
    FinancialReportVersionSummary,
):
    approval_notes: str | None

    snapshot_json: str
    snapshot: dict[str, Any]


class FinancialReportVersionListResponse(
    BaseModel,
):
    financial_report_id: str
    revision_series_id: str

    items: list[
        FinancialReportVersionSummary
    ]

    total: int


class FinaliseFinancialReportResponse(
    BaseModel,
):
    financial_report_id: str
    report_status: str

    revision_series_id: str
    revision_number: int

    finalised_at: datetime
    accountant_name: str
    finalised_by: str

    version: FinancialReportVersionSummary


class CreateFinancialReportRevisionRequest(
    BaseModel,
):
    revision_reason: str = Field(
        min_length=1,
        max_length=20000,
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )