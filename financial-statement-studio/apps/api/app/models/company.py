from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import PrimaryKeyMixin, TimestampMixin


if TYPE_CHECKING:
    from app.models.financial_report import FinancialReport


class Company(
    PrimaryKeyMixin,
    TimestampMixin,
    Base,
):
    """A business or organisation using the application."""

    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
        index=True,
    )

    business_type: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        default="other",
        server_default="other",
        index=True,
    )

    registration_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    tin: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    ghana_card_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    telephone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    default_currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="GHS",
        server_default="GHS",
    )

    reporting_basis: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default="accrual",
        server_default="accrual",
    )

    logo_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
        index=True,
    )

    financial_reports: Mapped[list[FinancialReport]] = relationship(
        "FinancialReport",
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return (
            f"Company(id={self.id!r}, "
            f"name={self.name!r})"
        )