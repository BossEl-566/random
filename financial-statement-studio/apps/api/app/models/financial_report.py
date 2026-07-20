from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import PrimaryKeyMixin, TimestampMixin


if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.journal_entry import JournalEntry


class FinancialReport(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    A financial-statement document belonging to one company.

    Each reporting period is stored independently so that reports from
    different years do not overwrite one another.
    """

    __tablename__ = "financial_reports"

    __table_args__ = (
        CheckConstraint(
            "period_end >= period_start",
            name="period_dates",
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

    comparison_report_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(
            "financial_reports.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    report_type: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        default="annual_financial_statements",
        server_default="annual_financial_statements",
        index=True,
    )

    period_start: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    period_end: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    financial_year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="GHS",
        server_default="GHS",
    )

    business_template: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        default="other",
        server_default="other",
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )

    accountant_report_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    finalised_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    company: Mapped[Company] = relationship(
        "Company",
        back_populates="financial_reports",
    )

    journal_entries: Mapped[list[JournalEntry]] = relationship(
    "JournalEntry",
    back_populates="financial_report",
    cascade="all, delete-orphan",
    passive_deletes=True,
)

    comparison_report: Mapped[FinancialReport | None] = relationship(
        "FinancialReport",
        remote_side="FinancialReport.id",
        foreign_keys=[comparison_report_id],
        back_populates="comparison_dependents",
    )

    comparison_dependents: Mapped[list[FinancialReport]] = relationship(
        "FinancialReport",
        foreign_keys=[comparison_report_id],
        back_populates="comparison_report",
    )

    def __repr__(self) -> str:
        return (
            f"FinancialReport(id={self.id!r}, "
            f"title={self.title!r}, "
            f"status={self.status!r})"
        )