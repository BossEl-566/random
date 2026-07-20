from datetime import date, datetime
from enum import StrEnum
from typing import Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.company import BusinessType


class ReportType(StrEnum):
    """Types of financial documents supported by the workspace."""

    ANNUAL_FINANCIAL_STATEMENTS = (
        "annual_financial_statements"
    )
    MANAGEMENT_ACCOUNTS = "management_accounts"
    TAX_COMPUTATION = "tax_computation"
    CUSTOM_REPORT = "custom_report"


class ReportStatus(StrEnum):
    """Lifecycle status of a financial report."""

    DRAFT = "draft"
    INCOMPLETE = "incomplete"
    READY_FOR_REVIEW = "ready_for_review"
    FINALISED = "finalised"
    PRINTED = "printed"
    ARCHIVED = "archived"


def clean_optional_text(
    value: Any,
) -> Any:
    """Convert empty optional text values to None."""

    if not isinstance(value, str):
        return value

    cleaned_value = value.strip()

    return cleaned_value or None


def clean_currency(
    value: str | None,
) -> str | None:
    """Normalise three-letter currency codes."""

    if value is None:
        return None

    return value.strip().upper()


class FinancialReportCreate(BaseModel):
    """Payload used when creating a financial report."""

    company_id: str = Field(
        min_length=36,
        max_length=36,
    )

    title: str | None = Field(
        default=None,
        max_length=255,
    )

    report_type: ReportType = (
        ReportType.ANNUAL_FINANCIAL_STATEMENTS
    )

    period_start: date
    period_end: date

    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )

    business_template: BusinessType | None = None

    comparison_report_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )

    accountant_report_text: str | None = Field(
        default=None,
        max_length=20000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator(
        "title",
        "accountant_report_text",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(
        cls,
        value: str | None,
    ) -> str | None:
        return clean_currency(value)

    @model_validator(mode="after")
    def validate_reporting_period(
        self,
    ) -> Self:
        if self.period_end < self.period_start:
            raise ValueError(
                "Reporting end date cannot be before the start date.",
            )

        return self


class FinancialReportUpdate(BaseModel):
    """Payload used to partially update a financial report."""

    title: str | None = Field(
        default=None,
        max_length=255,
    )

    report_type: ReportType | None = None

    period_start: date | None = None
    period_end: date | None = None

    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )

    business_template: BusinessType | None = None

    comparison_report_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )

    accountant_report_text: str | None = Field(
        default=None,
        max_length=20000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator(
        "title",
        "accountant_report_text",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(
        cls,
        value: str | None,
    ) -> str | None:
        return clean_currency(value)


class FinancialReportResponse(BaseModel):
    """Financial report data returned by the API."""

    id: str
    company_id: str
    comparison_report_id: str | None

    title: str
    report_type: ReportType

    period_start: date
    period_end: date
    financial_year: int

    currency: str
    business_template: BusinessType
    status: ReportStatus

    accountant_report_text: str | None
    finalised_at: datetime | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class FinancialReportListResponse(BaseModel):
    """Paginated financial-report list."""

    items: list[FinancialReportResponse]
    total: int
    offset: int
    limit: int