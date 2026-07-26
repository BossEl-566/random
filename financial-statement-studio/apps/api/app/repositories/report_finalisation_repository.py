from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.models.company import Company
from app.models.financial_report import (
    FinancialReport,
)
from app.models.financial_report_note import (
    FinancialReportNote,
)
from app.models.financial_report_version import (
    FinancialReportVersion,
)
from app.models.journal_entry import (
    JournalEntry,
)
from app.models.ledger_account import (
    LedgerAccount,
)


class ReportFinalisationRepository:
    def get_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport | None:
        return database_session.get(
            FinancialReport,
            report_id,
        )

    def get_company(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company | None:
        return database_session.get(
            Company,
            company_id,
        )

    def list_ledger_accounts(
        self,
        database_session: Session,
        company_id: str,
    ) -> list[LedgerAccount]:
        statement = (
            select(LedgerAccount)
            .where(
                LedgerAccount.company_id
                == company_id,
            )
            .order_by(
                LedgerAccount.display_order.asc(),
                LedgerAccount.account_code.asc(),
                LedgerAccount.created_at.asc(),
            )
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def list_journal_entries(
        self,
        database_session: Session,
        report_id: str,
    ) -> list[JournalEntry]:
        statement = (
            select(JournalEntry)
            .options(
                selectinload(
                    JournalEntry.lines,
                ),
            )
            .where(
                JournalEntry.financial_report_id
                == report_id,
            )
            .order_by(
                JournalEntry.sequence_number.asc(),
                JournalEntry.created_at.asc(),
            )
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def list_notes(
        self,
        database_session: Session,
        report_id: str,
    ) -> list[FinancialReportNote]:
        statement = (
            select(FinancialReportNote)
            .where(
                FinancialReportNote
                .financial_report_id
                == report_id,
            )
            .order_by(
                FinancialReportNote
                .note_number
                .asc(),
                FinancialReportNote
                .created_at
                .asc(),
            )
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def count_entries_by_status(
        self,
        database_session: Session,
        *,
        report_id: str,
        entry_status: str,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(JournalEntry)
            .where(
                JournalEntry
                .financial_report_id
                == report_id,
                JournalEntry.status
                == entry_status,
            )
        )

        return int(
            database_session.scalar(
                statement,
            )
            or 0,
        )

    def count_active_notes(
        self,
        database_session: Session,
        report_id: str,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(
                FinancialReportNote,
            )
            .where(
                FinancialReportNote
                .financial_report_id
                == report_id,
                FinancialReportNote
                .is_active
                .is_(True),
            )
        )

        return int(
            database_session.scalar(
                statement,
            )
            or 0,
        )

    def get_version(
        self,
        database_session: Session,
        version_id: str,
    ) -> FinancialReportVersion | None:
        return database_session.get(
            FinancialReportVersion,
            version_id,
        )

    def get_version_by_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReportVersion | None:
        statement = select(
            FinancialReportVersion,
        ).where(
            FinancialReportVersion
            .financial_report_id
            == report_id,
        )

        return database_session.scalar(
            statement,
        )

    def list_versions(
        self,
        database_session: Session,
        revision_series_id: str,
    ) -> list[FinancialReportVersion]:
        statement = (
            select(
                FinancialReportVersion,
            )
            .where(
                FinancialReportVersion
                .revision_series_id
                == revision_series_id,
            )
            .order_by(
                FinancialReportVersion
                .revision_number
                .asc(),
            )
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def max_revision_number(
        self,
        database_session: Session,
        revision_series_id: str,
    ) -> int:
        statement = select(
            func.max(
                FinancialReport
                .revision_number,
            ),
        ).where(
            FinancialReport
            .revision_series_id
            == revision_series_id,
        )

        return int(
            database_session.scalar(
                statement,
            )
            or 0,
        )

    def get_successor_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport | None:
        statement = select(
            FinancialReport,
        ).where(
            FinancialReport
            .supersedes_report_id
            == report_id,
        )

        return database_session.scalar(
            statement,
        )