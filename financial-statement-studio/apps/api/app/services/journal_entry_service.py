from collections.abc import Iterable
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)
from sqlalchemy.orm import Session

from app.models.financial_report import FinancialReport
from app.models.journal_entry import JournalEntry
from app.models.journal_line import JournalLine
from app.models.ledger_account import LedgerAccount
from app.repositories.journal_entry_repository import (
    JournalEntryRepository,
)
from app.schemas.journal_entry import (
    JournalEntryCreate,
    JournalEntryStatus,
    JournalEntryType,
    JournalEntryUpdate,
    JournalEntryVoid,
    JournalLineInput,
    TrialBalanceLine,
    TrialBalanceResponse,
)


MONEY_QUANTUM = Decimal("0.01")

LOCKED_REPORT_STATUSES = {
    "finalised",
    "printed",
    "archived",
}

ENTRY_NUMBER_PREFIXES = {
    JournalEntryType.OPENING_BALANCE: "OB",
    JournalEntryType.STANDARD: "JE",
    JournalEntryType.ADJUSTING: "ADJ",
    JournalEntryType.CLOSING: "CLS",
}


class JournalEntryServiceError(Exception):
    """Base error for journal operations."""


class JournalReportNotFoundError(
    JournalEntryServiceError,
):
    """Raised when a financial report is missing."""


class JournalEntryNotFoundError(
    JournalEntryServiceError,
):
    """Raised when a journal entry is missing."""


class JournalAccountNotFoundError(
    JournalEntryServiceError,
):
    """Raised when a selected ledger account is missing."""


class InvalidJournalAccountError(
    JournalEntryServiceError,
):
    """Raised when an account belongs to another company."""


class InactiveJournalAccountError(
    JournalEntryServiceError,
):
    """Raised when an inactive account is used."""


class InvalidJournalPeriodError(
    JournalEntryServiceError,
):
    """Raised when an entry date is outside the report period."""


class UnbalancedJournalEntryError(
    JournalEntryServiceError,
):
    """Raised when journal debits and credits do not match."""


class LockedJournalReportError(
    JournalEntryServiceError,
):
    """Raised when a report no longer accepts journal changes."""


class InvalidJournalEntryStateError(
    JournalEntryServiceError,
):
    """Raised when an entry status blocks an operation."""


class EmptyJournalEntryUpdateError(
    JournalEntryServiceError,
):
    """Raised when an update contains no fields."""


class JournalEntrySequenceConflictError(
    JournalEntryServiceError,
):
    """Raised when entry numbering conflicts."""


class JournalEntryPersistenceError(
    JournalEntryServiceError,
):
    """Raised when a journal database operation fails."""


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc,
    )


def calculate_totals(
    lines: Iterable[
        JournalLineInput | JournalLine
    ],
) -> tuple[Decimal, Decimal]:
    total_debit = sum(
        (
            line.debit
            for line in lines
        ),
        Decimal("0.00"),
    ).quantize(MONEY_QUANTUM)

    total_credit = sum(
        (
            line.credit
            for line in lines
        ),
        Decimal("0.00"),
    ).quantize(MONEY_QUANTUM)

    return total_debit, total_credit


class JournalEntryService:
    """Application rules for double-entry accounting."""

    def __init__(
        self,
        repository: JournalEntryRepository | None = None,
    ) -> None:
        self.repository = (
            repository
            or JournalEntryRepository()
        )

    def get_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport:
        try:
            financial_report = (
                self.repository.get_report_by_id(
                    database_session,
                    report_id,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The financial report could not be retrieved.",
            ) from error

        if financial_report is None:
            raise JournalReportNotFoundError(
                "The selected financial report was not found.",
            )

        return financial_report

    def get_entry(
        self,
        database_session: Session,
        entry_id: str,
    ) -> JournalEntry:
        try:
            journal_entry = (
                self.repository.get_entry_by_id(
                    database_session,
                    entry_id,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The journal entry could not be retrieved.",
            ) from error

        if journal_entry is None:
            raise JournalEntryNotFoundError(
                "The requested journal entry was not found.",
            )

        return journal_entry

    def ensure_report_editable(
        self,
        financial_report: FinancialReport,
    ) -> None:
        if (
            financial_report.status
            in LOCKED_REPORT_STATUSES
        ):
            raise LockedJournalReportError(
                (
                    "Journal entries cannot be changed because "
                    f"the report status is '{financial_report.status}'."
                ),
            )

    def validate_entry_date(
        self,
        financial_report: FinancialReport,
        entry_date: date,
        entry_type: JournalEntryType,
    ) -> None:
        if entry_type == JournalEntryType.OPENING_BALANCE:
            if entry_date != financial_report.period_start:
                raise InvalidJournalPeriodError(
                    (
                        "Opening-balance entries must use the "
                        "financial report's period start date."
                    ),
                )

            return

        if not (
            financial_report.period_start
            <= entry_date
            <= financial_report.period_end
        ):
            raise InvalidJournalPeriodError(
                (
                    "Journal entry date must fall between "
                    f"{financial_report.period_start} and "
                    f"{financial_report.period_end}."
                ),
            )

    def validate_balanced_lines(
        self,
        lines: Iterable[
            JournalLineInput | JournalLine
        ],
    ) -> None:
        line_list = list(lines)

        if len(line_list) < 2:
            raise UnbalancedJournalEntryError(
                "A journal entry must contain at least two lines.",
            )

        total_debit, total_credit = (
            calculate_totals(
                line_list,
            )
        )

        if total_debit != total_credit:
            raise UnbalancedJournalEntryError(
                (
                    "Journal entry debits and credits must be equal. "
                    f"Debits: {total_debit:.2f}; "
                    f"Credits: {total_credit:.2f}."
                ),
            )

        if total_debit <= Decimal("0.00"):
            raise UnbalancedJournalEntryError(
                "A journal entry total must be greater than zero.",
            )

    def validate_accounts(
        self,
        database_session: Session,
        *,
        company_id: str,
        account_ids: set[str],
        require_active: bool,
    ) -> dict[str, LedgerAccount]:
        try:
            accounts = (
                self.repository.get_accounts_by_ids(
                    database_session,
                    account_ids,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "Ledger accounts could not be retrieved.",
            ) from error

        accounts_by_id = {
            account.id: account
            for account in accounts
        }

        missing_ids = (
            account_ids
            - accounts_by_id.keys()
        )

        if missing_ids:
            raise JournalAccountNotFoundError(
                "One or more selected ledger accounts were not found.",
            )

        for account in accounts:
            if account.company_id != company_id:
                raise InvalidJournalAccountError(
                    (
                        f"Account {account.account_code} — "
                        f"{account.account_name} belongs to "
                        "another company."
                    ),
                )

            if (
                require_active
                and not account.is_active
            ):
                raise InactiveJournalAccountError(
                    (
                        f"Account {account.account_code} — "
                        f"{account.account_name} is inactive."
                    ),
                )

        return accounts_by_id

    def build_lines(
        self,
        payload_lines: list[JournalLineInput],
    ) -> list[JournalLine]:
        return [
            JournalLine(
                ledger_account_id=(
                    line.ledger_account_id
                ),
                line_number=line_number,
                description=line.description,
                debit=line.debit,
                credit=line.credit,
            )
            for line_number, line in enumerate(
                payload_lines,
                start=1,
            )
        ]

    def create_entry_number(
        self,
        financial_report: FinancialReport,
        entry_type: JournalEntryType,
        sequence_number: int,
    ) -> str:
        prefix = ENTRY_NUMBER_PREFIXES[
            entry_type
        ]

        return (
            f"{prefix}-"
            f"{financial_report.financial_year}-"
            f"{sequence_number:04d}"
        )

    def create_entry(
        self,
        database_session: Session,
        report_id: str,
        payload: JournalEntryCreate,
    ) -> JournalEntry:
        financial_report = self.get_report(
            database_session,
            report_id,
        )

        self.ensure_report_editable(
            financial_report,
        )

        self.validate_entry_date(
            financial_report,
            payload.entry_date,
            payload.entry_type,
        )

        self.validate_balanced_lines(
            payload.lines,
        )

        account_ids = {
            line.ledger_account_id
            for line in payload.lines
        }

        self.validate_accounts(
            database_session,
            company_id=(
                financial_report.company_id
            ),
            account_ids=account_ids,
            require_active=True,
        )

        try:
            sequence_number = (
                self.repository.get_next_sequence_number(
                    database_session,
                    financial_report.id,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The next journal-entry number could not be generated.",
            ) from error

        journal_entry = JournalEntry(
            company_id=financial_report.company_id,
            financial_report_id=financial_report.id,
            sequence_number=sequence_number,
            entry_number=self.create_entry_number(
                financial_report,
                payload.entry_type,
                sequence_number,
            ),
            entry_date=payload.entry_date,
            entry_type=payload.entry_type.value,
            status=JournalEntryStatus.DRAFT.value,
            source=payload.source.value,
            description=payload.description,
            reference=payload.reference,
            lines=self.build_lines(
                payload.lines,
            ),
        )

        try:
            return self.repository.create(
                database_session,
                journal_entry,
            )
        except IntegrityError as error:
            raise JournalEntrySequenceConflictError(
                (
                    "The journal-entry number conflicted with "
                    "another entry. Submit the entry again."
                ),
            ) from error
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The journal entry could not be saved.",
            ) from error

    def list_entries(
        self,
        database_session: Session,
        *,
        report_id: str,
        search: str | None,
        entry_status: JournalEntryStatus | None,
        entry_type: JournalEntryType | None,
        date_from: date | None,
        date_to: date | None,
        offset: int,
        limit: int,
    ) -> tuple[list[JournalEntry], int]:
        financial_report = self.get_report(
            database_session,
            report_id,
        )

        if (
            date_from
            and date_to
            and date_to < date_from
        ):
            raise InvalidJournalPeriodError(
                "Journal search end date cannot be before the start date.",
            )

        if (
            date_from
            and date_from
            < financial_report.period_start
        ):
            raise InvalidJournalPeriodError(
                "Journal search start date is outside the report period.",
            )

        if (
            date_to
            and date_to
            > financial_report.period_end
        ):
            raise InvalidJournalPeriodError(
                "Journal search end date is outside the report period.",
            )

        normalized_search = (
            search.strip()
            if search and search.strip()
            else None
        )

        try:
            return self.repository.list(
                database_session,
                report_id=report_id,
                search=normalized_search,
                entry_status=(
                    entry_status.value
                    if entry_status
                    else None
                ),
                entry_type=(
                    entry_type.value
                    if entry_type
                    else None
                ),
                date_from=date_from,
                date_to=date_to,
                offset=offset,
                limit=limit,
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "Journal entries could not be retrieved.",
            ) from error

    def update_entry(
        self,
        database_session: Session,
        entry_id: str,
        payload: JournalEntryUpdate,
    ) -> JournalEntry:
        journal_entry = self.get_entry(
            database_session,
            entry_id,
        )

        financial_report = self.get_report(
            database_session,
            journal_entry.financial_report_id,
        )

        self.ensure_report_editable(
            financial_report,
        )

        if (
            journal_entry.status
            != JournalEntryStatus.DRAFT.value
        ):
            raise InvalidJournalEntryStateError(
                "Only draft journal entries can be edited.",
            )

        supplied_fields = (
            payload.model_fields_set
        )

        if not supplied_fields:
            raise EmptyJournalEntryUpdateError(
                "Provide at least one journal-entry field to update.",
            )

        entry_type = (
            payload.entry_type
            if "entry_type" in supplied_fields
            and payload.entry_type is not None
            else JournalEntryType(
                journal_entry.entry_type,
            )
        )

        entry_date = (
            payload.entry_date
            if "entry_date" in supplied_fields
            and payload.entry_date is not None
            else journal_entry.entry_date
        )

        self.validate_entry_date(
            financial_report,
            entry_date,
            entry_type,
        )

        values: dict[str, object] = {}

        if "entry_date" in supplied_fields:
            values["entry_date"] = entry_date

        if "entry_type" in supplied_fields:
            values["entry_type"] = (
                entry_type.value
            )

        if "source" in supplied_fields:
            if payload.source is None:
                raise EmptyJournalEntryUpdateError(
                    "Journal source cannot be empty.",
                )

            values["source"] = (
                payload.source.value
            )

        if "description" in supplied_fields:
            if payload.description is None:
                raise EmptyJournalEntryUpdateError(
                    "Journal description cannot be empty.",
                )

            values["description"] = (
                payload.description
            )

        if "reference" in supplied_fields:
            values["reference"] = (
                payload.reference
            )

        replacement_lines: (
            list[JournalLine] | None
        ) = None

        if "lines" in supplied_fields:
            if payload.lines is None:
                raise EmptyJournalEntryUpdateError(
                    "Journal lines cannot be empty.",
                )

            self.validate_balanced_lines(
                payload.lines,
            )

            account_ids = {
                line.ledger_account_id
                for line in payload.lines
            }

            self.validate_accounts(
                database_session,
                company_id=journal_entry.company_id,
                account_ids=account_ids,
                require_active=True,
            )

            replacement_lines = self.build_lines(
                payload.lines,
            )

        try:
            return self.repository.update(
                database_session,
                journal_entry,
                values,
                replacement_lines,
            )
        except IntegrityError as error:
            raise JournalEntrySequenceConflictError(
                "The journal entry could not be updated because of a numbering conflict.",
            ) from error
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The journal entry could not be updated.",
            ) from error

    def post_entry(
        self,
        database_session: Session,
        entry_id: str,
    ) -> JournalEntry:
        journal_entry = self.get_entry(
            database_session,
            entry_id,
        )

        financial_report = self.get_report(
            database_session,
            journal_entry.financial_report_id,
        )

        self.ensure_report_editable(
            financial_report,
        )

        if (
            journal_entry.status
            == JournalEntryStatus.POSTED.value
        ):
            return journal_entry

        if (
            journal_entry.status
            == JournalEntryStatus.VOIDED.value
        ):
            raise InvalidJournalEntryStateError(
                "A voided journal entry cannot be posted.",
            )

        self.validate_entry_date(
            financial_report,
            journal_entry.entry_date,
            JournalEntryType(
                journal_entry.entry_type,
            ),
        )

        self.validate_balanced_lines(
            journal_entry.lines,
        )

        account_ids = {
            line.ledger_account_id
            for line in journal_entry.lines
        }

        self.validate_accounts(
            database_session,
            company_id=journal_entry.company_id,
            account_ids=account_ids,
            require_active=True,
        )

        try:
            return self.repository.update(
                database_session,
                journal_entry,
                {
                    "status": (
                        JournalEntryStatus.POSTED.value
                    ),
                    "posted_at": utc_now(),
                },
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The journal entry could not be posted.",
            ) from error

    def void_entry(
        self,
        database_session: Session,
        entry_id: str,
        payload: JournalEntryVoid,
    ) -> JournalEntry:
        journal_entry = self.get_entry(
            database_session,
            entry_id,
        )

        financial_report = self.get_report(
            database_session,
            journal_entry.financial_report_id,
        )

        self.ensure_report_editable(
            financial_report,
        )

        if (
            journal_entry.status
            == JournalEntryStatus.VOIDED.value
        ):
            return journal_entry

        if (
            journal_entry.status
            != JournalEntryStatus.POSTED.value
        ):
            raise InvalidJournalEntryStateError(
                "Only posted journal entries can be voided.",
            )

        try:
            return self.repository.update(
                database_session,
                journal_entry,
                {
                    "status": (
                        JournalEntryStatus.VOIDED.value
                    ),
                    "voided_at": utc_now(),
                    "void_reason": payload.reason,
                },
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The journal entry could not be voided.",
            ) from error

    def calculate_trial_balance(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date | None,
    ) -> TrialBalanceResponse:
        financial_report = self.get_report(
            database_session,
            report_id,
        )

        calculation_date = (
            as_of
            or financial_report.period_end
        )

        if not (
            financial_report.period_start
            <= calculation_date
            <= financial_report.period_end
        ):
            raise InvalidJournalPeriodError(
                (
                    "Trial Balance date must fall between "
                    f"{financial_report.period_start} and "
                    f"{financial_report.period_end}."
                ),
            )

        try:
            rows = (
                self.repository.get_trial_balance_rows(
                    database_session,
                    report_id=report_id,
                    as_of=calculation_date,
                )
            )

            posted_entry_count = (
                self.repository.count_posted_entries(
                    database_session,
                    report_id=report_id,
                    as_of=calculation_date,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "The Trial Balance could not be calculated.",
            ) from error

        items: list[TrialBalanceLine] = []

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for row in rows:
            movement_debit = Decimal(
                row["movement_debit"]
                or 0,
            ).quantize(MONEY_QUANTUM)

            movement_credit = Decimal(
                row["movement_credit"]
                or 0,
            ).quantize(MONEY_QUANTUM)

            net_balance = (
                movement_debit
                - movement_credit
            ).quantize(MONEY_QUANTUM)

            if net_balance >= Decimal("0.00"):
                debit_balance = net_balance
                credit_balance = Decimal("0.00")
            else:
                debit_balance = Decimal("0.00")
                credit_balance = (
                    -net_balance
                ).quantize(MONEY_QUANTUM)

            total_debit += debit_balance
            total_credit += credit_balance

            items.append(
                TrialBalanceLine(
                    ledger_account_id=(
                        row[
                            "ledger_account_id"
                        ]
                    ),
                    account_code=(
                        row["account_code"]
                    ),
                    account_name=(
                        row["account_name"]
                    ),
                    account_type=(
                        row["account_type"]
                    ),
                    report_category=(
                        row["report_category"]
                    ),
                    normal_balance=(
                        row["normal_balance"]
                    ),
                    movement_debit=(
                        movement_debit
                    ),
                    movement_credit=(
                        movement_credit
                    ),
                    debit_balance=(
                        debit_balance
                    ),
                    credit_balance=(
                        credit_balance
                    ),
                ),
            )

        total_debit = total_debit.quantize(
            MONEY_QUANTUM,
        )

        total_credit = total_credit.quantize(
            MONEY_QUANTUM,
        )

        return TrialBalanceResponse(
            financial_report_id=(
                financial_report.id
            ),
            company_id=(
                financial_report.company_id
            ),
            currency=financial_report.currency,
            as_of=calculation_date,
            posted_entry_count=(
                posted_entry_count
            ),
            items=items,
            total_debit=total_debit,
            total_credit=total_credit,
            is_balanced=(
                total_debit
                == total_credit
            ),
            generated_at=utc_now(),
        )