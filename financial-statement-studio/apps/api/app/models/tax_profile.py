from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.core.database import Base
from app.models.mixins import (
    PrimaryKeyMixin,
    TimestampMixin,
)


if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.tax_rule import TaxRule


class TaxProfile(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    A company's tax identity and jurisdiction configuration.

    One company may have multiple profiles when it operates under
    different tax registrations, business categories or jurisdictions.
    """

    __tablename__ = "tax_profiles"

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "profile_code",
            name="company_tax_profile_code",
        ),
        UniqueConstraint(
            "company_id",
            "profile_name",
            name="company_tax_profile_name",
        ),
    )

    company_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "companies.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    profile_code: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        index=True,
    )

    profile_name: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
        index=True,
    )

    jurisdiction_country_code: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
        default="GH",
        server_default="GH",
        index=True,
    )

    jurisdiction_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="Ghana",
        server_default="Ghana",
    )

    tax_identifier: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    taxpayer_category: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
        index=True,
    )

    company: Mapped[Company] = relationship(
        "Company",
        back_populates="tax_profiles",
    )

    rules: Mapped[list[TaxRule]] = relationship(
        "TaxRule",
        back_populates="tax_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "TaxRule.effective_from, "
            "TaxRule.display_order"
        ),
    )

    def __repr__(self) -> str:
        return (
            f"TaxProfile(id={self.id!r}, "
            f"company_id={self.company_id!r}, "
            f"code={self.profile_code!r})"
        )