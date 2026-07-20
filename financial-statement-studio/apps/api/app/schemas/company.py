from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class BusinessType(StrEnum):
    """Supported default company templates."""

    TRADING = "trading"
    SERVICE = "service"
    MANUFACTURING = "manufacturing"
    RETAIL = "retail"
    TRANSPORT_LOGISTICS = "transport_logistics"
    CHURCH_NONPROFIT = "church_nonprofit"
    SCHOOL = "school"
    OTHER = "other"


class ReportingBasis(StrEnum):
    """Accounting basis used by the company."""

    ACCRUAL = "accrual"
    CASH = "cash"
    MODIFIED_CASH = "modified_cash"


OPTIONAL_TEXT_FIELDS = (
    "registration_number",
    "tin",
    "ghana_card_number",
    "address",
    "telephone",
    "logo_path",
)


def clean_required_name(value: str) -> str:
    """
    Remove unnecessary spaces while keeping the company name readable.
    """

    cleaned_value = " ".join(value.split())

    if len(cleaned_value) < 2:
        raise ValueError(
            "Company name must contain at least two characters.",
        )

    return cleaned_value


def clean_optional_text(value: Any) -> Any:
    """
    Convert empty optional text fields to None.

    A blank value is different from a confirmed numeric zero, so blank
    optional text values are stored as null.
    """

    if not isinstance(value, str):
        return value

    cleaned_value = value.strip()

    if cleaned_value == "":
        return None

    return cleaned_value


def clean_currency(value: str) -> str:
    """Store three-letter currency codes in uppercase."""

    return value.strip().upper()


class CompanyBase(BaseModel):
    """Fields shared by company creation and API responses."""

    name: str = Field(
        min_length=2,
        max_length=180,
        examples=["Zackai Logistics"],
    )

    business_type: BusinessType = BusinessType.OTHER

    registration_number: str | None = Field(
        default=None,
        max_length=100,
    )

    tin: str | None = Field(
        default=None,
        max_length=100,
    )

    ghana_card_number: str | None = Field(
        default=None,
        max_length=100,
    )

    address: str | None = Field(
        default=None,
        max_length=2000,
    )

    telephone: str | None = Field(
        default=None,
        max_length=50,
    )

    email: EmailStr | None = None

    default_currency: str = Field(
        default="GHS",
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )

    reporting_basis: ReportingBasis = ReportingBasis.ACCRUAL

    logo_path: str | None = Field(
        default=None,
        max_length=2000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_required_name(value)

    @field_validator(
        *OPTIONAL_TEXT_FIELDS,
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator("default_currency")
    @classmethod
    def validate_currency(
        cls,
        value: str,
    ) -> str:
        return clean_currency(value)


class CompanyCreate(CompanyBase):
    """Payload used when creating a company."""

    pass


class CompanyUpdate(BaseModel):
    """
    Payload used for partial company updates.

    All fields are optional because PATCH changes only supplied fields.
    """

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=180,
    )

    business_type: BusinessType | None = None

    registration_number: str | None = Field(
        default=None,
        max_length=100,
    )

    tin: str | None = Field(
        default=None,
        max_length=100,
    )

    ghana_card_number: str | None = Field(
        default=None,
        max_length=100,
    )

    address: str | None = Field(
        default=None,
        max_length=2000,
    )

    telephone: str | None = Field(
        default=None,
        max_length=50,
    )

    email: EmailStr | None = None

    default_currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )

    reporting_basis: ReportingBasis | None = None

    logo_path: str | None = Field(
        default=None,
        max_length=2000,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    @field_validator("name")
    @classmethod
    def validate_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_required_name(value)

    @field_validator(
        *OPTIONAL_TEXT_FIELDS,
        mode="before",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Any,
    ) -> Any:
        return clean_optional_text(value)

    @field_validator("default_currency")
    @classmethod
    def validate_currency(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return clean_currency(value)


class CompanyResponse(CompanyBase):
    """Company data returned by the API."""

    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class CompanyListResponse(BaseModel):
    """Paginated company-list response."""

    items: list[CompanyResponse]
    total: int
    offset: int
    limit: int