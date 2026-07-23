from datetime import datetime
from enum import StrEnum
from typing import Any
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class AccountType(StrEnum):
    """Main accounting classifications."""

    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class ReportCategory(StrEnum):
    """Financial-statement sections used by the reporting engine."""

    REVENUE = "revenue"
    COST_OF_SALES = "cost_of_sales"
    DIRECT_SERVICE_COSTS = "direct_service_costs"
    MANUFACTURING_COSTS = "manufacturing_costs"
    OTHER_INCOME = "other_income"

    ADMINISTRATIVE_EXPENSES = (
        "administrative_expenses"
    )
    SELLING_DISTRIBUTION_EXPENSES = (
        "selling_distribution_expenses"
    )
    FINANCE_COSTS = "finance_costs"
    TAXATION = "taxation"

    CURRENT_ASSETS = "current_assets"
    NON_CURRENT_ASSETS = "non_current_assets"
    CURRENT_LIABILITIES = "current_liabilities"
    NON_CURRENT_LIABILITIES = (
        "non_current_liabilities"
    )
    EQUITY = "equity"


class CashFlowCategory(StrEnum):
    """Cash-flow classification for an account."""

    OPERATING = "operating"
    INVESTING = "investing"
    FINANCING = "financing"
    NON_CASH = "non_cash"
    NOT_APPLICABLE = "not_applicable"


class NormalBalance(StrEnum):
    """The side on which an account normally increases."""

    DEBIT = "debit"
    CREDIT = "credit"


def clean_required_text(value: str) -> str:
    cleaned_value = " ".join(value.split())

    if not cleaned_value:
        raise ValueError(
            "This field cannot be empty.",
        )

    return cleaned_value


def clean_account_code(value: str) -> str:
    cleaned_value = value.strip().upper()

    if not cleaned_value:
        raise ValueError(
            "Account code cannot be empty.",
        )

    return cleaned_value


def clean_optional_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    cleaned_value = value.strip()

    return cleaned_value or None


class LedgerAccountCreate(BaseModel):
    """Payload for creating a custom ledger account."""

    account_code: str = Field(
        min_length=1,
        max_length=30,
    )

    account_name: str = Field(
        min_length=2,
        max_length=180,
    )

    account_type: AccountType
    report_category: ReportCategory

    cash_flow_category: CashFlowCategory | None = None

    normal_balance: NormalBalance

    parent_account_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )

    display_order: int = Field(
        default=0,
        ge=0,
        le=100000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )
    is_cash_equivalent: bool = False

    @field_validator("account_code")
    @classmethod
    def validate_account_code(
        cls,
        value: str,
    ) -> str:
        return clean_account_code(value)

    @field_validator("account_name")
    @classmethod
    def validate_account_name(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)

    @field_validator(
        "parent_account_id",
        "description",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)


class LedgerAccountUpdate(BaseModel):
    """Payload for partially updating a ledger account."""

    account_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    account_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=180,
    )

    account_type: AccountType | None = None
    report_category: ReportCategory | None = None

    cash_flow_category: CashFlowCategory | None = None

    normal_balance: NormalBalance | None = None

    parent_account_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )

    display_order: int | None = Field(
        default=None,
        ge=0,
        le=100000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )
    is_cash_equivalent: bool | None = None

    @field_validator("account_code")
    @classmethod
    def validate_account_code(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_account_code(value)

    @field_validator("account_name")
    @classmethod
    def validate_account_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_required_text(value)

    @field_validator(
        "parent_account_id",
        "description",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)


class LedgerAccountResponse(BaseModel):
    """Ledger account returned by the API."""

    id: str
    company_id: str
    parent_account_id: str | None

    account_code: str
    account_name: str

    account_type: AccountType
    report_category: ReportCategory
    cash_flow_category: CashFlowCategory | None
    normal_balance: NormalBalance

    description: str | None

    is_system_account: bool
    is_cash_equivalent: bool
    is_active: bool
    display_order: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class LedgerAccountListResponse(BaseModel):
    """Paginated Chart of Accounts response."""

    items: list[LedgerAccountResponse]
    total: int
    offset: int
    limit: int


class ChartInitializationResponse(BaseModel):
    """Result of initializing a company's default accounts."""

    company_id: str
    business_template: str
    created_count: int
    skipped_count: int
    items: list[LedgerAccountResponse]