from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
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
    from app.models.journal_entry import JournalEntry
    from app.models.ledger_account import LedgerAccount


class JournalLine(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    One debit or credit line inside a Journal Entry.
    """

    __tablename__ = "journal_lines"

    __table_args__ = (
        UniqueConstraint(
            "journal_entry_id",
            "line_number",
            name="entry_line_number",
        ),
        CheckConstraint(
            "line_number > 0",
            name="line_number_positive",
        ),
        CheckConstraint(
            "debit >= 0",
            name="debit_non_negative",
        ),
        CheckConstraint(
            "credit >= 0",
            name="credit_non_negative",
        ),
        CheckConstraint(
            (
                "(debit > 0 AND credit = 0) "
                "OR "
                "(credit > 0 AND debit = 0)"
            ),
            name="exactly_one_amount_side",
        ),
    )

    journal_entry_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "journal_entries.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    ledger_account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "ledger_accounts.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    line_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    debit: Mapped[Decimal] = mapped_column(
        Numeric(
            precision=18,
            scale=2,
        ),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0.00",
    )

    credit: Mapped[Decimal] = mapped_column(
        Numeric(
            precision=18,
            scale=2,
        ),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0.00",
    )

    journal_entry: Mapped[JournalEntry] = relationship(
        "JournalEntry",
        back_populates="lines",
    )

    ledger_account: Mapped[LedgerAccount] = relationship(
        "LedgerAccount",
        back_populates="journal_lines",
    )

    def __repr__(self) -> str:
        return (
            f"JournalLine(id={self.id!r}, "
            f"account_id={self.ledger_account_id!r}, "
            f"debit={self.debit!r}, "
            f"credit={self.credit!r})"
        )