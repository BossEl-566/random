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
    from app.models.financial_report_note import (
        FinancialReportNote,
    )
    from app.models.financial_report_version import (
        FinancialReportVersion,
    )
    from app.models.journal_entry import (
        JournalEntry,
    )
    from app.models.tax_calculation import (
    TaxCalculation,
)


class FinancialReport(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    A financial-statement document belonging to one company.

    Each reporting period is stored independently so that reports
    from different years and revisions do not overwrite one another.
    """

    __tablename__ = "financial_reports"

    __table_args__ = (
        CheckConstraint(
            "period_end >= period_start",
            name="period_dates",
        ),
        CheckConstraint(
            "revision_number > 0",
            name="revision_number_positive",
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

    revision_series_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )

    revision_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
        index=True,
    )

    supersedes_report_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )

    revision_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
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

    accountant_name: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True,
    )

    accountant_firm_name: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True,
    )

    accountant_professional_designation: Mapped[
        str | None
    ] = mapped_column(
        String(180),
        nullable=True,
    )

    accountant_firm_address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    finalised_by: Mapped[str | None] = mapped_column(
        String(180),
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

    journal_entries: Mapped[
        list[JournalEntry]
    ] = relationship(
        "JournalEntry",
        back_populates="financial_report",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    notes: Mapped[
        list[FinancialReportNote]
    ] = relationship(
        "FinancialReportNote",
        back_populates="financial_report",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    versions: Mapped[
        list[FinancialReportVersion]
    ] = relationship(
        "FinancialReportVersion",
        back_populates="financial_report",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "FinancialReportVersion.revision_number"
        ),
    )

    tax_calculations: Mapped[
    list[TaxCalculation]
] = relationship(
    "TaxCalculation",
    back_populates="financial_report",
    cascade="all, delete-orphan",
    passive_deletes=True,
    order_by="TaxCalculation.calculation_date",
)

    comparison_report: Mapped[
        FinancialReport | None
    ] = relationship(
        "FinancialReport",
        remote_side="FinancialReport.id",
        foreign_keys=[comparison_report_id],
        back_populates="comparison_dependents",
    )

    comparison_dependents: Mapped[
        list[FinancialReport]
    ] = relationship(
        "FinancialReport",
        foreign_keys=[comparison_report_id],
        back_populates="comparison_report",
    )

    def __repr__(self) -> str:
        return (
            f"FinancialReport(id={self.id!r}, "
            f"title={self.title!r}, "
            f"revision={self.revision_number!r}, "
            f"status={self.status!r})"
        )