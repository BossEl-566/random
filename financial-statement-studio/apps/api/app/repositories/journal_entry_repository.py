from datetime import date
from typing import Any

from sqlalchemy import (
    func,
    or_,
    select,
)
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.models.company import Company
from app.models.financial_report import FinancialReport
from app.models.journal_entry import JournalEntry
from app.models.journal_line import JournalLine
from app.models.ledger_account import LedgerAccount


class JournalEntryRepository:
    """Database operations for journal entries and Trial Balance."""

    def get_report_by_id(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport | None:
        return database_session.get(
            FinancialReport,
            report_id,
        )

    def get_company_by_id(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company | None:
        return database_session.get(
            Company,
            company_id,
        )

    def get_accounts_by_ids(
        self,
        database_session: Session,
        account_ids: set[str],
    ) -> list[LedgerAccount]:
        if not account_ids:
            return []

        statement = select(
            LedgerAccount,
        ).where(
            LedgerAccount.id.in_(
                account_ids,
            ),
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def get_entry_by_id(
        self,
        database_session: Session,
        entry_id: str,
    ) -> JournalEntry | None:
        statement = (
            select(JournalEntry)
            .options(
                selectinload(
                    JournalEntry.lines,
                ),
            )
            .where(
                JournalEntry.id
                == entry_id,
            )
        )

        return database_session.scalar(
            statement,
        )

    def get_next_sequence_number(
        self,
        database_session: Session,
        report_id: str,
    ) -> int:
        statement = select(
            (
                func.coalesce(
                    func.max(
                        JournalEntry.sequence_number,
                    ),
                    0,
                )
                + 1
            ),
        ).where(
            JournalEntry.financial_report_id
            == report_id,
        )

        return int(
            database_session.scalar(
                statement,
            )
            or 1
        )

    def create(
        self,
        database_session: Session,
        journal_entry: JournalEntry,
    ) -> JournalEntry:
        try:
            database_session.add(
                journal_entry,
            )
            database_session.commit()
        except SQLAlchemyError:
            database_session.rollback()
            raise

        saved_entry = self.get_entry_by_id(
            database_session,
            journal_entry.id,
        )

        return saved_entry or journal_entry

    def list(
        self,
        database_session: Session,
        *,
        report_id: str,
        search: str | None,
        entry_status: str | None,
        entry_type: str | None,
        date_from: date | None,
        date_to: date | None,
        offset: int,
        limit: int,
    ) -> tuple[list[JournalEntry], int]:
        filters = [
            JournalEntry.financial_report_id
            == report_id,
        ]

        if search:
            normalized_search = (
                search.strip().lower()
            )

            filters.append(
                or_(
                    func.lower(
                        JournalEntry.entry_number,
                    ).contains(
                        normalized_search,
                    ),
                    func.lower(
                        JournalEntry.description,
                    ).contains(
                        normalized_search,
                    ),
                    func.lower(
                        func.coalesce(
                            JournalEntry.reference,
                            "",
                        ),
                    ).contains(
                        normalized_search,
                    ),
                ),
            )

        if entry_status:
            filters.append(
                JournalEntry.status
                == entry_status,
            )

        if entry_type:
            filters.append(
                JournalEntry.entry_type
                == entry_type,
            )

        if date_from:
            filters.append(
                JournalEntry.entry_date
                >= date_from,
            )

        if date_to:
            filters.append(
                JournalEntry.entry_date
                <= date_to,
            )

        list_statement = (
            select(JournalEntry)
            .options(
                selectinload(
                    JournalEntry.lines,
                ),
            )
            .where(*filters)
            .order_by(
                JournalEntry.entry_date.desc(),
                JournalEntry.sequence_number.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        count_statement = (
            select(func.count())
            .select_from(JournalEntry)
            .where(*filters)
        )

        entries = list(
            database_session.scalars(
                list_statement,
            ).all(),
        )

        total = (
            database_session.scalar(
                count_statement,
            )
            or 0
        )

        return entries, total

    def update(
        self,
        database_session: Session,
        journal_entry: JournalEntry,
        values: dict[str, object],
        replacement_lines: list[JournalLine] | None = None,
    ) -> JournalEntry:
        for field_name, value in values.items():
            setattr(
                journal_entry,
                field_name,
                value,
            )

        try:
            if replacement_lines is not None:
                journal_entry.lines.clear()
                database_session.flush()

                journal_entry.lines.extend(
                    replacement_lines,
                )

            database_session.add(
                journal_entry,
            )
            database_session.commit()
        except SQLAlchemyError:
            database_session.rollback()
            raise

        saved_entry = self.get_entry_by_id(
            database_session,
            journal_entry.id,
        )

        return saved_entry or journal_entry

    def get_trial_balance_rows(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date,
    ) -> list[RowMapping]:
        statement = (
            select(
                LedgerAccount.id.label(
                    "ledger_account_id",
                ),
                LedgerAccount.account_code.label(
                    "account_code",
                ),
                LedgerAccount.account_name.label(
                    "account_name",
                ),
                LedgerAccount.account_type.label(
                    "account_type",
                ),
                LedgerAccount.report_category.label(
                    "report_category",
                ),
                LedgerAccount.normal_balance.label(
                    "normal_balance",
                ),
                func.coalesce(
                    func.sum(
                        JournalLine.debit,
                    ),
                    0,
                ).label(
                    "movement_debit",
                ),
                func.coalesce(
                    func.sum(
                        JournalLine.credit,
                    ),
                    0,
                ).label(
                    "movement_credit",
                ),
            )
            .join(
                JournalLine,
                JournalLine.ledger_account_id
                == LedgerAccount.id,
            )
            .join(
                JournalEntry,
                JournalEntry.id
                == JournalLine.journal_entry_id,
            )
            .where(
                JournalEntry.financial_report_id
                == report_id,
                JournalEntry.status
                == "posted",
                JournalEntry.entry_date
                <= as_of,
            )
            .group_by(
                LedgerAccount.id,
                LedgerAccount.account_code,
                LedgerAccount.account_name,
                LedgerAccount.account_type,
                LedgerAccount.report_category,
                LedgerAccount.normal_balance,
                LedgerAccount.display_order,
            )
            .order_by(
                LedgerAccount.display_order.asc(),
                LedgerAccount.account_code.asc(),
            )
        )

        return list(
            database_session.execute(
                statement,
            ).mappings(),
        )

    def count_posted_entries(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(JournalEntry)
            .where(
                JournalEntry.financial_report_id
                == report_id,
                JournalEntry.status
                == "posted",
                JournalEntry.entry_date
                <= as_of,
            )
        )

        return int(
            database_session.scalar(
                statement,
            )
            or 0
        )