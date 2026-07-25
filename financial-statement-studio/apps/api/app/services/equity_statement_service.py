from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.journal_entry import (
    JournalEntry,
)
from app.models.ledger_account import (
    LedgerAccount,
)
from app.repositories.equity_statement_repository import (
    EquityStatementRepository,
)
from app.schemas.equity_statement import (
    EquityMovementLine,
    EquityMovementSection,
    EquityMovementSectionLine,
    StatementOfChangesInEquityResponse,
)
from app.services.financial_statement_service import (
    FinancialStatementService,
)
from app.services.journal_entry_service import (
    InvalidJournalPeriodError,
    JournalEntryPersistenceError,
    JournalEntryService,
    utc_now,
)


MONEY_QUANTUM = Decimal("0.01")


def money(
    value: Decimal | int | str,
) -> Decimal:
    return Decimal(value).quantize(
        MONEY_QUANTUM,
    )


class EquityStatementService:
    """
    Calculates the Statement of Changes in Equity
    from posted journal entries.
    """

    def __init__(
        self,
        *,
        repository:
        EquityStatementRepository
        | None = None,
        journal_entry_service:
        JournalEntryService
        | None = None,
        financial_statement_service:
        FinancialStatementService
        | None = None,
    ) -> None:
        self.repository = (
            repository
            or EquityStatementRepository()
        )

        self.journal_entry_service = (
            journal_entry_service
            or JournalEntryService()
        )

        self.financial_statement_service = (
            financial_statement_service
            or FinancialStatementService(
                self.journal_entry_service,
            )
        )

    def equity_natural_balance(
        self,
        *,
        debit: Decimal,
        credit: Decimal,
    ) -> Decimal:
        return money(
            credit - debit,
        )

    def add_amount(
        self,
        target: dict[str, Decimal],
        account_id: str,
        amount: Decimal,
    ) -> None:
        target[account_id] = money(
            target.get(
                account_id,
                Decimal("0.00"),
            )
            + amount,
        )

    def record_equity_balances(
        self,
        entry: JournalEntry,
        *,
        accounts: dict[
            str,
            LedgerAccount,
        ],
        opening_debits: dict[
            str,
            Decimal,
        ],
        opening_credits: dict[
            str,
            Decimal,
        ],
        period_debits: dict[
            str,
            Decimal,
        ],
        period_credits: dict[
            str,
            Decimal,
        ],
    ) -> None:
        for line in entry.lines:
            account = (
                line.ledger_account
            )

            if (
                account is None
                or account.account_type
                != "equity"
            ):
                continue

            accounts[account.id] = account

            debit = money(
                line.debit
                or Decimal("0.00"),
            )

            credit = money(
                line.credit
                or Decimal("0.00"),
            )

            if (
                entry.entry_type
                == "opening_balance"
            ):
                opening_debits[
                    account.id
                ] += debit

                opening_credits[
                    account.id
                ] += credit
            else:
                period_debits[
                    account.id
                ] += debit

                period_credits[
                    account.id
                ] += credit

    def build_movement_section(
        self,
        *,
        key: str,
        title: str,
        amounts: dict[str, Decimal],
        accounts: dict[
            str,
            LedgerAccount,
        ],
    ) -> EquityMovementSection:
        items: list[
            EquityMovementSectionLine
        ] = []

        sorted_account_ids = sorted(
            amounts,
            key=lambda account_id: (
                accounts[
                    account_id
                ].display_order,
                accounts[
                    account_id
                ].account_code,
            ),
        )

        for account_id in sorted_account_ids:
            amount = money(
                amounts[account_id],
            )

            if amount == Decimal("0.00"):
                continue

            account = accounts[
                account_id
            ]

            items.append(
                EquityMovementSectionLine(
                    ledger_account_id=(
                        account.id
                    ),
                    account_code=(
                        account.account_code
                    ),
                    account_name=(
                        account.account_name
                    ),
                    amount=amount,
                ),
            )

        total = money(
            sum(
                (
                    item.amount
                    for item in items
                ),
                Decimal("0.00"),
            ),
        )

        return EquityMovementSection(
            key=key,
            title=title,
            items=items,
            total=total,
        )

    def calculate(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date | None,
    ) -> StatementOfChangesInEquityResponse:
        financial_report = (
            self.journal_entry_service
            .get_report(
                database_session,
                report_id,
            )
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
                    "Statement of Changes in Equity "
                    "date must fall between "
                    f"{financial_report.period_start} "
                    "and "
                    f"{financial_report.period_end}."
                ),
            )

        try:
            entries = (
                self.repository
                .list_posted_entries(
                    database_session,
                    report_id=report_id,
                    as_of=calculation_date,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                (
                    "Posted journal entries could "
                    "not be retrieved for the "
                    "Statement of Changes in Equity."
                ),
            ) from error

        accounts: dict[
            str,
            LedgerAccount,
        ] = {}

        opening_debits: dict[
            str,
            Decimal,
        ] = defaultdict(
            lambda: Decimal("0.00"),
        )

        opening_credits: dict[
            str,
            Decimal,
        ] = defaultdict(
            lambda: Decimal("0.00"),
        )

        period_debits: dict[
            str,
            Decimal,
        ] = defaultdict(
            lambda: Decimal("0.00"),
        )

        period_credits: dict[
            str,
            Decimal,
        ] = defaultdict(
            lambda: Decimal("0.00"),
        )

        for entry in entries:
            self.record_equity_balances(
                entry,
                accounts=accounts,
                opening_debits=(
                    opening_debits
                ),
                opening_credits=(
                    opening_credits
                ),
                period_debits=(
                    period_debits
                ),
                period_credits=(
                    period_credits
                ),
            )

        direct_increase_amounts: dict[
            str,
            Decimal,
        ] = {}

        direct_decrease_amounts: dict[
            str,
            Decimal,
        ] = {}

        equity_account_lines: list[
            EquityMovementLine
        ] = []

        opening_recorded_equity = (
            Decimal("0.00")
        )

        recorded_closing_equity = (
            Decimal("0.00")
        )

        calculated_recorded_closing = (
            Decimal("0.00")
        )

        sorted_accounts = sorted(
            accounts.values(),
            key=lambda account: (
                account.display_order,
                account.account_code,
            ),
        )

        for account in sorted_accounts:
            opening_balance = (
                self.equity_natural_balance(
                    debit=money(
                        opening_debits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                    credit=money(
                        opening_credits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                )
            )

            net_direct_movement = (
                self.equity_natural_balance(
                    debit=money(
                        period_debits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                    credit=money(
                        period_credits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                )
            )

            direct_increases = money(
                max(
                    net_direct_movement,
                    Decimal("0.00"),
                ),
            )

            direct_decreases = money(
                min(
                    net_direct_movement,
                    Decimal("0.00"),
                ),
            )

            recorded_closing_balance = (
                money(
                    opening_balance
                    + net_direct_movement,
                )
            )

            if (
                direct_increases
                != Decimal("0.00")
            ):
                direct_increase_amounts[
                    account.id
                ] = direct_increases

            if (
                direct_decreases
                != Decimal("0.00")
            ):
                direct_decrease_amounts[
                    account.id
                ] = direct_decreases

            equity_account_lines.append(
                EquityMovementLine(
                    ledger_account_id=(
                        account.id
                    ),
                    account_code=(
                        account.account_code
                    ),
                    account_name=(
                        account.account_name
                    ),
                    opening_balance=(
                        opening_balance
                    ),
                    direct_increases=(
                        direct_increases
                    ),
                    direct_decreases=(
                        direct_decreases
                    ),
                    net_direct_movement=(
                        net_direct_movement
                    ),
                    recorded_closing_balance=(
                        recorded_closing_balance
                    ),
                ),
            )

            opening_recorded_equity += (
                opening_balance
            )

            recorded_closing_equity += (
                recorded_closing_balance
            )

            calculated_recorded_closing += (
                opening_balance
                + net_direct_movement
            )

        opening_recorded_equity = money(
            opening_recorded_equity,
        )

        recorded_closing_equity = money(
            recorded_closing_equity,
        )

        calculated_recorded_closing = money(
            calculated_recorded_closing,
        )

        direct_increases_section = (
            self.build_movement_section(
                key="direct_increases",
                title=(
                    "Contributions and Other "
                    "Direct Increases"
                ),
                amounts=(
                    direct_increase_amounts
                ),
                accounts=accounts,
            )
        )

        direct_decreases_section = (
            self.build_movement_section(
                key="direct_decreases",
                title=(
                    "Drawings, Distributions and "
                    "Other Direct Decreases"
                ),
                amounts=(
                    direct_decrease_amounts
                ),
                accounts=accounts,
            )
        )

        net_direct_equity_movement = money(
            direct_increases_section.total
            + direct_decreases_section.total,
        )

        profit_or_loss = (
            self.financial_statement_service
            .calculate_profit_or_loss(
                database_session,
                report_id=report_id,
                as_of=calculation_date,
            )
        )

        profit_after_tax = money(
            profit_or_loss.profit_after_tax,
        )

        total_closing_equity = money(
            recorded_closing_equity
            + profit_after_tax,
        )

        reconciliation_difference = money(
            recorded_closing_equity
            - calculated_recorded_closing,
        )

        return (
            StatementOfChangesInEquityResponse(
                financial_report_id=(
                    financial_report.id
                ),
                company_id=(
                    financial_report.company_id
                ),
                currency=(
                    financial_report.currency
                ),
                period_start=(
                    financial_report.period_start
                ),
                period_end=(
                    calculation_date
                ),
                opening_recorded_equity=(
                    opening_recorded_equity
                ),
                direct_increases=(
                    direct_increases_section
                ),
                direct_decreases=(
                    direct_decreases_section
                ),
                net_direct_equity_movement=(
                    net_direct_equity_movement
                ),
                profit_after_tax=(
                    profit_after_tax
                ),
                recorded_closing_equity=(
                    recorded_closing_equity
                ),
                total_closing_equity=(
                    total_closing_equity
                ),
                equity_accounts=(
                    equity_account_lines
                ),
                calculated_recorded_closing_equity=(
                    calculated_recorded_closing
                ),
                equity_reconciliation_difference=(
                    reconciliation_difference
                ),
                is_reconciled=(
                    reconciliation_difference
                    == Decimal("0.00")
                ),
                generated_at=utc_now(),
            )
        )