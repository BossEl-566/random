from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
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
    utc_now,
)


if TYPE_CHECKING:
    from app.models.financial_report import (
        FinancialReport,
    )
    from app.models.tax_rule import TaxRule


class TaxCalculation(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    An auditable result produced from one effective tax rule.

    Applied rule values and labels are copied into this record so that
    later edits to a tax rule do not rewrite historical calculations.
    """

    __tablename__ = "tax_calculations"

    __table_args__ = (
        CheckConstraint(
            "tax_amount >= 0",
            name="tax_amount_non_negative",
        ),
        CheckConstraint(
            (
                "rate_applied IS NULL "
                "OR "
                "(rate_applied >= 0 "
                "AND rate_applied <= 100)"
            ),
            name="rate_applied_range",
        ),
        CheckConstraint(
            (
                "fixed_amount_applied IS NULL "
                "OR fixed_amount_applied >= 0"
            ),
            name="fixed_amount_applied_non_negative",
        ),
    )

    financial_report_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "financial_reports.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    tax_rule_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "tax_rules.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    calculation_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    tax_base: Mapped[Decimal] = mapped_column(
        Numeric(
            precision=18,
            scale=2,
        ),
        nullable=False,
    )

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(
            precision=18,
            scale=2,
        ),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="GHS",
        server_default="GHS",
    )

    rule_code_snapshot: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    rule_name_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    tax_type_snapshot: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    calculation_method_snapshot: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    rate_applied: Mapped[Decimal | None] = mapped_column(
        Numeric(
            precision=9,
            scale=6,
        ),
        nullable=True,
    )

    fixed_amount_applied: Mapped[
        Decimal | None
    ] = mapped_column(
        Numeric(
            precision=18,
            scale=2,
        ),
        nullable=True,
    )

    calculation_details_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )

    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    financial_report: Mapped[
        FinancialReport
    ] = relationship(
        "FinancialReport",
        back_populates="tax_calculations",
    )

    tax_rule: Mapped[TaxRule] = relationship(
        "TaxRule",
        back_populates="calculations",
    )

    def __repr__(self) -> str:
        return (
            f"TaxCalculation(id={self.id!r}, "
            f"report_id={self.financial_report_id!r}, "
            f"tax_type={self.tax_type_snapshot!r}, "
            f"tax_amount={self.tax_amount!r})"
        )