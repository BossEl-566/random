from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
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
    from app.models.financial_report import (
        FinancialReport,
    )


class FinancialReportVersion(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    An immutable snapshot of a formally finalised report revision.

    The snapshot preserves the report, company, journal, account,
    note and Trial Balance data that existed when finalisation
    occurred.
    """

    __tablename__ = "financial_report_versions"

    __table_args__ = (
        UniqueConstraint(
            "financial_report_id",
            name="financial_report_final_version",
        ),
        UniqueConstraint(
            "revision_series_id",
            "revision_number",
            name="report_series_revision",
        ),
        CheckConstraint(
            "revision_number > 0",
            name="revision_number_positive",
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

    revision_series_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )

    revision_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    finalised_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    finalised_by: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
    )

    accountant_name: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
    )

    approval_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    snapshot_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    snapshot_checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    financial_report: Mapped[
        FinancialReport
    ] = relationship(
        "FinancialReport",
        back_populates="versions",
    )

    def __repr__(self) -> str:
        return (
            f"FinancialReportVersion(id={self.id!r}, "
            f"report_id={self.financial_report_id!r}, "
            f"revision={self.revision_number!r})"
        )