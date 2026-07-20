from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
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
    from app.models.company import Company
    from app.models.financial_report import (
        FinancialReport,
    )
    from app.models.journal_line import JournalLine


class JournalEntry(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    Header record for one double-entry accounting transaction.

    The actual debit and credit amounts are stored in JournalLine.
    """

    __tablename__ = "journal_entries"

    __table_args__ = (
        UniqueConstraint(
            "financial_report_id",
            "sequence_number",
            name="report_sequence_number",
        ),
        UniqueConstraint(
            "financial_report_id",
            "entry_number",
            name="report_entry_number",
        ),
        CheckConstraint(
            "sequence_number > 0",
            name="sequence_number_positive",
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

    financial_report_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "financial_reports.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    entry_number: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        index=True,
    )

    entry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    entry_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="standard",
        server_default="standard",
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="manual",
        server_default="manual",
        index=True,
    )

    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    reference: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    voided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    void_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    company: Mapped[Company] = relationship(
        "Company",
        back_populates="journal_entries",
    )

    financial_report: Mapped[FinancialReport] = relationship(
        "FinancialReport",
        back_populates="journal_entries",
    )

    lines: Mapped[list[JournalLine]] = relationship(
        "JournalLine",
        back_populates="journal_entry",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="JournalLine.line_number",
    )

    @property
    def total_debit(self) -> Decimal:
        return sum(
            (
                line.debit
                for line in self.lines
            ),
            Decimal("0.00"),
        )

    @property
    def total_credit(self) -> Decimal:
        return sum(
            (
                line.credit
                for line in self.lines
            ),
            Decimal("0.00"),
        )

    def __repr__(self) -> str:
        return (
            f"JournalEntry(id={self.id!r}, "
            f"entry_number={self.entry_number!r}, "
            f"status={self.status!r})"
        )