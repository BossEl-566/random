from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class TaxCalculationMethod(StrEnum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class TaxRuleStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    RETIRED = "retired"


class TaxCalculationStatus(StrEnum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"


def clean_optional_text(
    value: Any,
) -> Any:
    if not isinstance(value, str):
        return value

    cleaned = value.strip()

    return cleaned or None


def clean_required_code(
    value: str,
) -> str:
    cleaned = (
        value.strip()
        .upper()
        .replace(" ", "-")
    )

    if not cleaned:
        raise ValueError(
            "A code is required.",
        )

    return cleaned


def clean_currency(
    value: str,
) -> str:
    return value.strip().upper()


def clean_country_code(
    value: str,
) -> str:
    return value.strip().upper()


class TaxProfileCreate(BaseModel):
    company_id: str = Field(
        min_length=36,
        max_length=36,
    )

    profile_code: str = Field(
        min_length=1,
        max_length=60,
    )

    profile_name: str = Field(
        min_length=1,
        max_length=180,
    )

    jurisdiction_country_code: str = Field(
        default="GH",
        min_length=2,
        max_length=2,
        pattern=r"^[A-Za-z]{2}$",
    )

    jurisdiction_name: str = Field(
        default="Ghana",
        min_length=1,
        max_length=120,
    )

    tax_identifier: str | None = Field(
        default=None,
        max_length=120,
    )

    taxpayer_category: str | None = Field(
        default=None,
        max_length=120,
    )

    description: str | None = Field(
        default=None,
        max_length=20000,
    )

    is_default: bool = False
    is_active: bool = True

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("profile_code")
    @classmethod
    def validate_profile_code(
        cls,
        value: str,
    ) -> str:
        return clean_required_code(value)

    @field_validator(
        "tax_identifier",
        "taxpayer_category",
        "description",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator(
        "jurisdiction_country_code",
    )
    @classmethod
    def validate_country_code(
        cls,
        value: str,
    ) -> str:
        return clean_country_code(value)


class TaxProfileUpdate(BaseModel):
    profile_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=60,
    )

    profile_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=180,
    )

    jurisdiction_country_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=2,
        pattern=r"^[A-Za-z]{2}$",
    )

    jurisdiction_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    tax_identifier: str | None = Field(
        default=None,
        max_length=120,
    )

    taxpayer_category: str | None = Field(
        default=None,
        max_length=120,
    )

    description: str | None = Field(
        default=None,
        max_length=20000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("profile_code")
    @classmethod
    def validate_profile_code(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_required_code(value)

    @field_validator(
        "tax_identifier",
        "taxpayer_category",
        "description",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator(
        "jurisdiction_country_code",
    )
    @classmethod
    def validate_country_code(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_country_code(value)


class TaxProfileResponse(BaseModel):
    id: str
    company_id: str

    profile_code: str
    profile_name: str

    jurisdiction_country_code: str
    jurisdiction_name: str

    tax_identifier: str | None
    taxpayer_category: str | None
    description: str | None

    is_default: bool
    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class TaxProfileListResponse(BaseModel):
    company_id: str
    items: list[TaxProfileResponse]
    total: int


class TaxRuleCreate(BaseModel):
    rule_code: str = Field(
        min_length=1,
        max_length=100,
    )

    rule_name: str = Field(
        min_length=1,
        max_length=255,
    )

    tax_type: str = Field(
        min_length=1,
        max_length=80,
    )

    calculation_method: TaxCalculationMethod

    rate_percentage: Decimal | None = Field(
        default=None,
        ge=Decimal("0"),
        le=Decimal("100"),
    )

    fixed_amount: Decimal | None = Field(
        default=None,
        ge=Decimal("0"),
    )

    currency: str = Field(
        default="GHS",
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )

    effective_from: date
    effective_to: date | None = None

    taxpayer_category: str | None = Field(
        default=None,
        max_length=120,
    )

    business_activity: str | None = Field(
        default=None,
        max_length=120,
    )

    source_reference: str | None = Field(
        default=None,
        max_length=20000,
    )

    notes: str | None = Field(
        default=None,
        max_length=20000,
    )

    display_order: int = Field(
        default=0,
        ge=0,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("rule_code")
    @classmethod
    def validate_rule_code(
        cls,
        value: str,
    ) -> str:
        return clean_required_code(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(
        cls,
        value: str,
    ) -> str:
        return clean_currency(value)

    @field_validator(
        "taxpayer_category",
        "business_activity",
        "source_reference",
        "notes",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @model_validator(mode="after")
    def validate_rule_values(
        self,
    ) -> Self:
        if (
            self.effective_to is not None
            and self.effective_to
            < self.effective_from
        ):
            raise ValueError(
                "Effective end date cannot be before the start date.",
            )

        if (
            self.calculation_method
            == TaxCalculationMethod.PERCENTAGE
        ):
            if self.rate_percentage is None:
                raise ValueError(
                    "Percentage rules require a percentage rate.",
                )

            if self.fixed_amount is not None:
                raise ValueError(
                    "Percentage rules cannot contain a fixed amount.",
                )

        if (
            self.calculation_method
            == TaxCalculationMethod.FIXED_AMOUNT
        ):
            if self.fixed_amount is None:
                raise ValueError(
                    "Fixed-amount rules require a fixed amount.",
                )

            if self.rate_percentage is not None:
                raise ValueError(
                    "Fixed-amount rules cannot contain a percentage rate.",
                )

        return self


class TaxRuleUpdate(BaseModel):
    rule_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    rule_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    tax_type: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
    )

    calculation_method: TaxCalculationMethod | None = None

    rate_percentage: Decimal | None = Field(
        default=None,
        ge=Decimal("0"),
        le=Decimal("100"),
    )

    fixed_amount: Decimal | None = Field(
        default=None,
        ge=Decimal("0"),
    )

    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )

    effective_from: date | None = None
    effective_to: date | None = None

    taxpayer_category: str | None = Field(
        default=None,
        max_length=120,
    )

    business_activity: str | None = Field(
        default=None,
        max_length=120,
    )

    source_reference: str | None = Field(
        default=None,
        max_length=20000,
    )

    notes: str | None = Field(
        default=None,
        max_length=20000,
    )

    display_order: int | None = Field(
        default=None,
        ge=0,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("rule_code")
    @classmethod
    def validate_rule_code(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_required_code(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_currency(value)

    @field_validator(
        "taxpayer_category",
        "business_activity",
        "source_reference",
        "notes",
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)


class TaxRuleRetireRequest(BaseModel):
    effective_to: date


class TaxRuleResponse(BaseModel):
    id: str
    tax_profile_id: str

    rule_code: str
    rule_name: str
    tax_type: str

    calculation_method: TaxCalculationMethod

    rate_percentage: Decimal | None
    fixed_amount: Decimal | None

    currency: str

    effective_from: date
    effective_to: date | None

    taxpayer_category: str | None
    business_activity: str | None

    status: TaxRuleStatus

    source_reference: str | None
    notes: str | None

    is_system_rule: bool
    display_order: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class TaxRuleListResponse(BaseModel):
    tax_profile_id: str
    items: list[TaxRuleResponse]
    total: int


class TaxCalculationPreviewRequest(
    BaseModel,
):
    tax_profile_id: str = Field(
        min_length=36,
        max_length=36,
    )

    rule_code: str = Field(
        min_length=1,
        max_length=100,
    )

    calculation_date: date | None = None

    tax_base: Decimal = Field(
        ge=Decimal("0"),
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("rule_code")
    @classmethod
    def validate_rule_code(
        cls,
        value: str,
    ) -> str:
        return clean_required_code(value)


class TaxCalculationPreviewResponse(
    BaseModel,
):
    financial_report_id: str
    tax_profile_id: str
    tax_rule_id: str

    calculation_date: date

    rule_code: str
    rule_name: str
    tax_type: str

    calculation_method: TaxCalculationMethod

    tax_base: Decimal
    rate_applied: Decimal | None
    fixed_amount_applied: Decimal | None
    tax_amount: Decimal

    currency: str
    generated_at: datetime


class TaxCalculationResponse(BaseModel):
    id: str

    financial_report_id: str
    tax_rule_id: str

    calculation_date: date

    tax_base: Decimal
    tax_amount: Decimal
    currency: str

    rule_code_snapshot: str
    rule_name_snapshot: str
    tax_type_snapshot: str

    calculation_method_snapshot: str

    rate_applied: Decimal | None
    fixed_amount_applied: Decimal | None

    calculation_details_json: str | None

    status: TaxCalculationStatus
    calculated_at: datetime

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class TaxCalculationListResponse(
    BaseModel,
):
    financial_report_id: str
    items: list[TaxCalculationResponse]
    total: int