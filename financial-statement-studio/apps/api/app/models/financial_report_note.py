from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
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
    from app.models.disclosure_template import (
        DisclosureTemplate,
    )
    from app.models.financial_report import (
        FinancialReport,
    )


class FinancialReportNote(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    One numbered note belonging to a financial report.

    A note may contain an accounting policy, a general
    disclosure or additional information for a particular
    financial-statement line.
    """

    __tablename__ = "financial_report_notes"

    __table_args__ = (
        UniqueConstraint(
            "financial_report_id",
            "note_number",
            name="report_note_number",
        ),
        CheckConstraint(
            "note_number > 0",
            name="note_number_positive",
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

    template_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(
            "disclosure_templates.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    note_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    note_type: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        default="general_disclosure",
        server_default="general_disclosure",
        index=True,
    )

    statement_name: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
        index=True,
    )

    statement_line_key: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        server_default="",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
        index=True,
    )

    financial_report: Mapped[
        FinancialReport
    ] = relationship(
        "FinancialReport",
        back_populates="notes",
    )

    template: Mapped[
        DisclosureTemplate | None
    ] = relationship(
        "DisclosureTemplate",
        back_populates="report_notes",
    )

    def __repr__(self) -> str:
        return (
            f"FinancialReportNote(id={self.id!r}, "
            f"report_id={self.financial_report_id!r}, "
            f"note_number={self.note_number!r}, "
            f"title={self.title!r})"
        )