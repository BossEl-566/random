from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
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
    from app.models.tax_calculation import (
        TaxCalculation,
    )
    from app.models.tax_profile import TaxProfile


class TaxRule(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    An effective-dated tax rate or fixed-amount rule.

    A rule represents configuration only. It does not alter historical
    tax calculations that have already stored their applied values.
    """

    __tablename__ = "tax_rules"

    __table_args__ = (
        UniqueConstraint(
            "tax_profile_id",
            "rule_code",
            "effective_from",
            name="profile_rule_effective_date",
        ),
        CheckConstraint(
            (
                "effective_to IS NULL "
                "OR effective_to >= effective_from"
            ),
            name="effective_dates",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="display_order_non_negative",
        ),
        CheckConstraint(
            (
                "rate_percentage IS NULL "
                "OR "
                "(rate_percentage >= 0 "
                "AND rate_percentage <= 100)"
            ),
            name="percentage_range",
        ),
        CheckConstraint(
            (
                "fixed_amount IS NULL "
                "OR fixed_amount >= 0"
            ),
            name="fixed_amount_non_negative",
        ),
        CheckConstraint(
            (
                "("
                "calculation_method = 'percentage' "
                "AND rate_percentage IS NOT NULL "
                "AND fixed_amount IS NULL"
                ") "
                "OR "
                "("
                "calculation_method = 'fixed_amount' "
                "AND fixed_amount IS NOT NULL "
                "AND rate_percentage IS NULL"
                ")"
            ),
            name="calculation_value_matches_method",
        ),
    )

    tax_profile_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "tax_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    rule_code: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    rule_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    tax_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    calculation_method: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    rate_percentage: Mapped[Decimal | None] = mapped_column(
        Numeric(
            precision=9,
            scale=6,
        ),
        nullable=True,
    )

    fixed_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(
            precision=18,
            scale=2,
        ),
        nullable=True,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="GHS",
        server_default="GHS",
    )

    effective_from: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    effective_to: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )

    taxpayer_category: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    business_activity: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )

    source_reference: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_system_rule: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        index=True,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    tax_profile: Mapped[TaxProfile] = relationship(
        "TaxProfile",
        back_populates="rules",
    )

    calculations: Mapped[
        list[TaxCalculation]
    ] = relationship(
        "TaxCalculation",
        back_populates="tax_rule",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return (
            f"TaxRule(id={self.id!r}, "
            f"code={self.rule_code!r}, "
            f"tax_type={self.tax_type!r}, "
            f"effective_from={self.effective_from!r})"
        )