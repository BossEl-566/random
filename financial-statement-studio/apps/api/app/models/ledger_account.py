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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import PrimaryKeyMixin, TimestampMixin


if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.journal_line import JournalLine


class LedgerAccount(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """
    One account within a company's Chart of Accounts.

    Examples include Bank, Sales Revenue, Accounts Payable,
    Salaries, Motor Vehicles and Owner's Capital.
    """

    __tablename__ = "ledger_accounts"

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "account_code",
            name="company_account_code",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="display_order_non_negative",
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

    parent_account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(
            "ledger_accounts.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    account_code: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    account_name: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
        index=True,
    )

    account_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    report_category: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        index=True,
    )

    cash_flow_category: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        index=True,
    )

    normal_balance: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_system_account: Mapped[bool] = mapped_column(
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

    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    company: Mapped[Company] = relationship(
        "Company",
        back_populates="ledger_accounts",
    )

    journal_lines: Mapped[list[JournalLine]] = relationship(
    "JournalLine",
    back_populates="ledger_account",
)

    parent_account: Mapped[LedgerAccount | None] = relationship(
        "LedgerAccount",
        remote_side="LedgerAccount.id",
        foreign_keys=[parent_account_id],
        back_populates="child_accounts",
    )

    child_accounts: Mapped[list[LedgerAccount]] = relationship(
        "LedgerAccount",
        foreign_keys=[parent_account_id],
        back_populates="parent_account",
    )

    def __repr__(self) -> str:
        return (
            f"LedgerAccount(id={self.id!r}, "
            f"code={self.account_code!r}, "
            f"name={self.account_name!r})"
        )