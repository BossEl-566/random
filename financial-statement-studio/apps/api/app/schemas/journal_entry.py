from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


MONEY_QUANTUM = Decimal("0.01")

MoneyAmount = Annotated[
    Decimal,
    Field(
        ge=Decimal("0.00"),
        max_digits=18,
        decimal_places=2,
    ),
]


class JournalEntryType(StrEnum):
    """Purpose of a journal entry."""

    OPENING_BALANCE = "opening_balance"
    STANDARD = "standard"
    ADJUSTING = "adjusting"
    CLOSING = "closing"


class JournalEntryStatus(StrEnum):
    """Lifecycle status of a journal entry."""

    DRAFT = "draft"
    POSTED = "posted"
    VOIDED = "voided"


class JournalSource(StrEnum):
    """Origin of a journal entry."""

    MANUAL = "manual"
    IMPORTED = "imported"
    SYSTEM = "system"


def clean_optional_text(
    value: Any,
) -> Any:
    if not isinstance(value, str):
        return value

    cleaned_value = value.strip()

    return cleaned_value or None


def clean_required_text(
    value: str,
) -> str:
    cleaned_value = " ".join(
        value.split(),
    )

    if len(cleaned_value) < 2:
        raise ValueError(
            "Description must contain at least two characters.",
        )

    return cleaned_value


class JournalLineInput(BaseModel):
    """One debit or credit line supplied to the API."""

    ledger_account_id: str = Field(
        min_length=36,
        max_length=36,
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )

    debit: MoneyAmount = Decimal("0.00")
    credit: MoneyAmount = Decimal("0.00")

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator(
        "description",
        mode="before",
    )
    @classmethod
    def validate_description(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator(
        "debit",
        "credit",
    )
    @classmethod
    def quantize_amount(
        cls,
        value: Decimal,
    ) -> Decimal:
        return value.quantize(
            MONEY_QUANTUM,
        )

    @model_validator(mode="after")
    def validate_amount_side(
        self,
    ) -> Self:
        has_debit = (
            self.debit > Decimal("0.00")
        )

        has_credit = (
            self.credit > Decimal("0.00")
        )

        if has_debit == has_credit:
            raise ValueError(
                (
                    "Each journal line must contain "
                    "either a debit or a credit, but not both."
                ),
            )

        return self


def validate_balanced_lines(
    lines: list[JournalLineInput],
) -> None:
    total_debit = sum(
        (
            line.debit
            for line in lines
        ),
        Decimal("0.00"),
    )

    total_credit = sum(
        (
            line.credit
            for line in lines
        ),
        Decimal("0.00"),
    )

    if total_debit != total_credit:
        raise ValueError(
            (
                "Journal entry debits and credits must be equal. "
                f"Debits: {total_debit:.2f}; "
                f"Credits: {total_credit:.2f}."
            ),
        )

    if total_debit <= Decimal("0.00"):
        raise ValueError(
            "A journal entry total must be greater than zero.",
        )


class JournalEntryCreate(BaseModel):
    """Payload used when creating a journal entry."""

    entry_date: date

    entry_type: JournalEntryType = (
        JournalEntryType.STANDARD
    )

    source: JournalSource = JournalSource.MANUAL

    description: str = Field(
        min_length=2,
        max_length=500,
    )

    reference: str | None = Field(
        default=None,
        max_length=120,
    )

    lines: list[JournalLineInput] = Field(
        min_length=2,
        max_length=500,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("description")
    @classmethod
    def validate_description(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)

    @field_validator(
        "reference",
        mode="before",
    )
    @classmethod
    def validate_reference(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @model_validator(mode="after")
    def validate_balanced_entry(
        self,
    ) -> Self:
        validate_balanced_lines(
            self.lines,
        )

        return self


class JournalEntryUpdate(BaseModel):
    """Payload used to update a draft journal entry."""

    entry_date: date | None = None
    entry_type: JournalEntryType | None = None
    source: JournalSource | None = None

    description: str | None = Field(
        default=None,
        min_length=2,
        max_length=500,
    )

    reference: str | None = Field(
        default=None,
        max_length=120,
    )

    lines: list[JournalLineInput] | None = Field(
        default=None,
        min_length=2,
        max_length=500,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("description")
    @classmethod
    def validate_description(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_required_text(value)

    @field_validator(
        "reference",
        mode="before",
    )
    @classmethod
    def validate_reference(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @model_validator(mode="after")
    def validate_updated_lines(
        self,
    ) -> Self:
        if self.lines is not None:
            validate_balanced_lines(
                self.lines,
            )

        return self


class JournalEntryVoid(BaseModel):
    """Reason required when voiding a posted entry."""

    reason: str = Field(
        min_length=3,
        max_length=2000,
    )

    @field_validator("reason")
    @classmethod
    def validate_reason(
        cls,
        value: str,
    ) -> str:
        cleaned_value = " ".join(
            value.split(),
        )

        if len(cleaned_value) < 3:
            raise ValueError(
                "Void reason must contain at least three characters.",
            )

        return cleaned_value


class JournalLineResponse(BaseModel):
    """Journal line returned by the API."""

    id: str
    journal_entry_id: str
    ledger_account_id: str
    line_number: int
    description: str | None
    debit: Decimal
    credit: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class JournalEntryResponse(BaseModel):
    """Complete journal entry returned by the API."""

    id: str
    company_id: str
    financial_report_id: str

    sequence_number: int
    entry_number: str
    entry_date: date
    entry_type: JournalEntryType
    status: JournalEntryStatus
    source: JournalSource

    description: str
    reference: str | None

    posted_at: datetime | None
    voided_at: datetime | None
    void_reason: str | None

    lines: list[JournalLineResponse]

    total_debit: Decimal
    total_credit: Decimal

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class JournalEntryListResponse(BaseModel):
    """Paginated journal-entry response."""

    items: list[JournalEntryResponse]
    total: int
    offset: int
    limit: int


class TrialBalanceLine(BaseModel):
    """One account balance in the Trial Balance."""

    ledger_account_id: str
    account_code: str
    account_name: str
    account_type: str
    report_category: str
    normal_balance: str

    movement_debit: Decimal
    movement_credit: Decimal

    debit_balance: Decimal
    credit_balance: Decimal


class TrialBalanceResponse(BaseModel):
    """Calculated Trial Balance for a financial report."""

    financial_report_id: str
    company_id: str
    currency: str
    as_of: date

    posted_entry_count: int

    items: list[TrialBalanceLine]

    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool

    generated_at: datetime