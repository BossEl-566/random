from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
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
    from app.models.financial_report_note import (
        FinancialReportNote,
    )


class DisclosureTemplate(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    A reusable template for an accounting policy,
    financial-statement note or general disclosure.

    Templates are independent of a particular report.
    They are copied into report notes when selected.
    """

    __tablename__ = "disclosure_templates"

    __table_args__ = (
        UniqueConstraint(
            "template_key",
            name="template_key_unique",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="display_order_non_negative",
        ),
    )

    template_key: Mapped[str] = mapped_column(
        String(120),
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

    default_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        server_default="",
    )

    is_system_template: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
        index=True,
    )

    is_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
        index=True,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    report_notes: Mapped[
        list[FinancialReportNote]
    ] = relationship(
        "FinancialReportNote",
        back_populates="template",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return (
            f"DisclosureTemplate(id={self.id!r}, "
            f"key={self.template_key!r}, "
            f"title={self.title!r})"
        )