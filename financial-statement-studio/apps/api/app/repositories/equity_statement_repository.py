from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.models.journal_entry import (
    JournalEntry,
)
from app.models.journal_line import (
    JournalLine,
)


class EquityStatementRepository:
    """
    Retrieves posted journal entries needed for
    the Statement of Changes in Equity.
    """

    def list_posted_entries(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date,
    ) -> list[JournalEntry]:
        statement = (
            select(JournalEntry)
            .options(
                selectinload(
                    JournalEntry.lines,
                ).selectinload(
                    JournalLine.ledger_account,
                ),
            )
            .where(
                JournalEntry.financial_report_id
                == report_id,
                JournalEntry.status
                == "posted",
                JournalEntry.entry_date
                <= as_of,
            )
            .order_by(
                JournalEntry.entry_date.asc(),
                JournalEntry.sequence_number.asc(),
            )
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )