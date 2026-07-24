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
from app.repositories.cash_flow_repository import (
    CashFlowRepository,
)
from app.schemas.cash_flow import (
    CashFlowStatementLine,
    CashFlowStatementSection,
    StatementOfCashFlowsResponse,
)
from app.services.cash_flow_readiness_service import (
    CashFlowReadinessService,
)
from app.services.financial_statement_service import (
    FinancialStatementService,
)
from app.services.journal_entry_service import (
    JournalEntryPersistenceError,
    JournalEntryService,
    JournalEntryServiceError,
    utc_now,
)


MONEY_QUANTUM = Decimal("0.01")


class CashFlowNotReadyError(
    JournalEntryServiceError,
):
    """
    Raised when the Chart of Accounts is not ready
    for cash-flow calculations.
    """


def money(
    value: Decimal | int | str,
) -> Decimal:
    return Decimal(value).quantize(
        MONEY_QUANTUM,
    )


def line_debit(
    value: Decimal,
) -> Decimal:
    return money(
        value or Decimal("0.00"),
    )


def line_credit(
    value: Decimal,
) -> Decimal:
    return money(
        value or Decimal("0.00"),
    )


class CashFlowStatementService:
    """
    Calculates an indirect-method Statement of Cash Flows.
    """

    def __init__(
        self,
        *,
        repository: CashFlowRepository | None = None,
        journal_entry_service: JournalEntryService
        | None = None,
        readiness_service: CashFlowReadinessService
        | None = None,
        financial_statement_service:
        FinancialStatementService
        | None = None,
    ) -> None:
        self.repository = (
            repository
            or CashFlowRepository()
        )

        self.journal_entry_service = (
            journal_entry_service
            or JournalEntryService()
        )

        self.readiness_service = (
            readiness_service
            or CashFlowReadinessService(
                self.journal_entry_service,
            )
        )

        self.financial_statement_service = (
            financial_statement_service
            or FinancialStatementService(
                self.journal_entry_service,
            )
        )

    def add_account_amount(
        self,
        amounts: dict[str, Decimal],
        accounts: dict[
            str,
            LedgerAccount,
        ],
        account: LedgerAccount,
        amount: Decimal,
    ) -> None:
        accounts[account.id] = account

        amounts[account.id] = money(
            amounts.get(
                account.id,
                Decimal("0.00"),
            )
            + amount,
        )

    def natural_balance(
        self,
        account: LedgerAccount,
        debit: Decimal,
        credit: Decimal,
    ) -> Decimal:
        if account.account_type in {
            "asset",
            "expense",
        }:
            return money(
                debit - credit,
            )

        if account.account_type in {
            "liability",
            "equity",
            "revenue",
        }:
            return money(
                credit - debit,
            )

        return money(
            debit - credit,
        )

    def create_line(
        self,
        account: LedgerAccount,
        amount: Decimal,
        *,
        account_name: str | None = None,
    ) -> CashFlowStatementLine:
        return CashFlowStatementLine(
            ledger_account_id=account.id,
            account_code=(
                account.account_code
            ),
            account_name=(
                account_name
                or account.account_name
            ),
            amount=money(amount),
        )

    def build_section(
        self,
        *,
        key: str,
        title: str,
        amounts: dict[str, Decimal],
        accounts: dict[
            str,
            LedgerAccount,
        ],
        names: dict[str, str] | None = None,
    ) -> CashFlowStatementSection:
        items: list[
            CashFlowStatementLine
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
                self.create_line(
                    account,
                    amount,
                    account_name=(
                        names.get(
                            account_id,
                        )
                        if names
                        else None
                    ),
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

        return CashFlowStatementSection(
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
    ) -> StatementOfCashFlowsResponse:
        financial_report = (
            self.journal_entry_service.get_report(
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
            from app.services.journal_entry_service import (
                InvalidJournalPeriodError,
            )

            raise InvalidJournalPeriodError(
                (
                    "Statement of Cash Flows date must fall between "
                    f"{financial_report.period_start} and "
                    f"{financial_report.period_end}."
                ),
            )

        readiness = (
            self.readiness_service.calculate_readiness(
                database_session,
                report_id,
            )
        )

        if not readiness.is_ready:
            blocking_messages = [
                warning.message
                for warning in readiness.warnings
                if warning.code in {
                    "NO_ACTIVE_CASH_ACCOUNT",
                    "CASH_ACCOUNT_NOT_CURRENT_ASSET",
                    "MISSING_CASH_FLOW_CATEGORY",
                }
            ]

            message = (
                "; ".join(
                    blocking_messages,
                )
                or (
                    "The Chart of Accounts is not ready "
                    "for cash-flow calculations."
                )
            )

            raise CashFlowNotReadyError(
                message,
            )

        try:
            entries = (
                self.repository.list_posted_entries(
                    database_session,
                    report_id=report_id,
                    as_of=calculation_date,
                )
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "Posted journal entries could not be retrieved for the Statement of Cash Flows.",
            ) from error

        account_lookup: dict[
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

        closing_debits: dict[
            str,
            Decimal,
        ] = defaultdict(
            lambda: Decimal("0.00"),
        )

        closing_credits: dict[
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

        investing_amounts: dict[
            str,
            Decimal,
        ] = {}

        financing_amounts: dict[
            str,
            Decimal,
        ] = {}

        for entry in entries:
            self.record_balances(
                entry,
                account_lookup=account_lookup,
                opening_debits=opening_debits,
                opening_credits=opening_credits,
                closing_debits=closing_debits,
                closing_credits=closing_credits,
                period_debits=period_debits,
                period_credits=period_credits,
            )

            if (
                entry.entry_type
                == "opening_balance"
            ):
                continue

            has_cash_line = any(
                line.ledger_account
                is not None
                and line.ledger_account
                .is_cash_equivalent
                for line in entry.lines
            )

            if not has_cash_line:
                continue

            for line in entry.lines:
                account = (
                    line.ledger_account
                )

                if (
                    account is None
                    or account.is_cash_equivalent
                ):
                    continue

                cash_flow_amount = money(
                    line_credit(
                        line.credit,
                    )
                    - line_debit(
                        line.debit,
                    ),
                )

                if (
                    account.cash_flow_category
                    == "investing"
                ):
                    self.add_account_amount(
                        investing_amounts,
                        account_lookup,
                        account,
                        cash_flow_amount,
                    )

                if (
                    account.cash_flow_category
                    == "financing"
                ):
                    self.add_account_amount(
                        financing_amounts,
                        account_lookup,
                        account,
                        cash_flow_amount,
                    )

        profit_or_loss = (
            self.financial_statement_service
            .calculate_profit_or_loss(
                database_session,
                report_id=report_id,
                as_of=calculation_date,
            )
        )

        non_cash_amounts = (
            self.calculate_non_cash_adjustments(
                account_lookup=account_lookup,
                period_debits=period_debits,
                period_credits=period_credits,
            )
        )

        (
            working_capital_amounts,
            working_capital_names,
        ) = self.calculate_working_capital_adjustments(
            account_lookup=account_lookup,
            opening_debits=opening_debits,
            opening_credits=opening_credits,
            closing_debits=closing_debits,
            closing_credits=closing_credits,
        )

        non_cash_section = self.build_section(
            key="non_cash_adjustments",
            title="Non-cash Adjustments",
            amounts=non_cash_amounts,
            accounts=account_lookup,
        )

        working_capital_section = self.build_section(
            key="working_capital_adjustments",
            title="Working-capital Movements",
            amounts=working_capital_amounts,
            accounts=account_lookup,
            names=working_capital_names,
        )

        investing_section = self.build_section(
            key="investing_activities",
            title="Investing Activities",
            amounts=investing_amounts,
            accounts=account_lookup,
        )

        financing_section = self.build_section(
            key="financing_activities",
            title="Financing Activities",
            amounts=financing_amounts,
            accounts=account_lookup,
        )

        profit_after_tax = money(
            profit_or_loss.profit_after_tax,
        )

        net_cash_from_operating = money(
            profit_after_tax
            + non_cash_section.total
            + working_capital_section.total,
        )

        net_cash_from_investing = money(
            investing_section.total,
        )

        net_cash_from_financing = money(
            financing_section.total,
        )

        net_cash_movement = money(
            net_cash_from_operating
            + net_cash_from_investing
            + net_cash_from_financing,
        )

        (
            opening_cash,
            closing_cash,
            cash_account_lines,
        ) = self.calculate_cash_balances(
            account_lookup=account_lookup,
            opening_debits=opening_debits,
            opening_credits=opening_credits,
            closing_debits=closing_debits,
            closing_credits=closing_credits,
        )

        calculated_closing_cash = money(
            opening_cash
            + net_cash_movement,
        )

        reconciliation_difference = money(
            closing_cash
            - calculated_closing_cash,
        )

        return StatementOfCashFlowsResponse(
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
            period_end=calculation_date,
            profit_after_tax=(
                profit_after_tax
            ),
            non_cash_adjustments=(
                non_cash_section
            ),
            working_capital_adjustments=(
                working_capital_section
            ),
            net_cash_from_operating_activities=(
                net_cash_from_operating
            ),
            investing_activities=(
                investing_section
            ),
            net_cash_from_investing_activities=(
                net_cash_from_investing
            ),
            financing_activities=(
                financing_section
            ),
            net_cash_from_financing_activities=(
                net_cash_from_financing
            ),
            net_increase_decrease_in_cash=(
                net_cash_movement
            ),
            opening_cash_balance=(
                opening_cash
            ),
            calculated_closing_cash=(
                calculated_closing_cash
            ),
            closing_cash_balance=(
                closing_cash
            ),
            cash_accounts=(
                cash_account_lines
            ),
            cash_reconciliation_difference=(
                reconciliation_difference
            ),
            is_reconciled=(
                reconciliation_difference
                == Decimal("0.00")
            ),
            generated_at=utc_now(),
        )

    def record_balances(
        self,
        entry: JournalEntry,
        *,
        account_lookup: dict[
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
        closing_debits: dict[
            str,
            Decimal,
        ],
        closing_credits: dict[
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

            if account is None:
                continue

            account_lookup[
                account.id
            ] = account

            debit = line_debit(
                line.debit,
            )

            credit = line_credit(
                line.credit,
            )

            closing_debits[
                account.id
            ] += debit

            closing_credits[
                account.id
            ] += credit

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

    def calculate_non_cash_adjustments(
        self,
        *,
        account_lookup: dict[
            str,
            LedgerAccount,
        ],
        period_debits: dict[
            str,
            Decimal,
        ],
        period_credits: dict[
            str,
            Decimal,
        ],
    ) -> dict[str, Decimal]:
        amounts: dict[
            str,
            Decimal,
        ] = {}

        for account_id, account in (
            account_lookup.items()
        ):
            if (
                account.cash_flow_category
                != "non_cash"
            ):
                continue

            if account.account_type not in {
                "expense",
                "revenue",
            }:
                continue

            adjustment = money(
                period_debits.get(
                    account_id,
                    Decimal("0.00"),
                )
                - period_credits.get(
                    account_id,
                    Decimal("0.00"),
                ),
            )

            if adjustment != Decimal("0.00"):
                amounts[
                    account_id
                ] = adjustment

        return amounts

    def calculate_working_capital_adjustments(
        self,
        *,
        account_lookup: dict[
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
        closing_debits: dict[
            str,
            Decimal,
        ],
        closing_credits: dict[
            str,
            Decimal,
        ],
    ) -> tuple[
        dict[str, Decimal],
        dict[str, str],
    ]:
        amounts: dict[
            str,
            Decimal,
        ] = {}

        names: dict[
            str,
            str,
        ] = {}

        for account_id, account in (
            account_lookup.items()
        ):
            if account.is_cash_equivalent:
                continue

            if (
                account.cash_flow_category
                != "operating"
            ):
                continue

            if account.report_category not in {
                "current_assets",
                "current_liabilities",
            }:
                continue

            opening_balance = self.natural_balance(
                account,
                money(
                    opening_debits.get(
                        account_id,
                        Decimal("0.00"),
                    ),
                ),
                money(
                    opening_credits.get(
                        account_id,
                        Decimal("0.00"),
                    ),
                ),
            )

            closing_balance = self.natural_balance(
                account,
                money(
                    closing_debits.get(
                        account_id,
                        Decimal("0.00"),
                    ),
                ),
                money(
                    closing_credits.get(
                        account_id,
                        Decimal("0.00"),
                    ),
                ),
            )

            movement = money(
                closing_balance
                - opening_balance,
            )

            if (
                account.report_category
                == "current_assets"
            ):
                adjustment = money(
                    -movement,
                )

                movement_word = (
                    "Increase in"
                    if movement > 0
                    else "Decrease in"
                )
            else:
                adjustment = money(
                    movement,
                )

                movement_word = (
                    "Increase in"
                    if movement > 0
                    else "Decrease in"
                )

            if adjustment == Decimal("0.00"):
                continue

            amounts[
                account_id
            ] = adjustment

            names[
                account_id
            ] = (
                f"{movement_word} "
                f"{account.account_name}"
            )

        return amounts, names

    def calculate_cash_balances(
        self,
        *,
        account_lookup: dict[
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
        closing_debits: dict[
            str,
            Decimal,
        ],
        closing_credits: dict[
            str,
            Decimal,
        ],
    ) -> tuple[
        Decimal,
        Decimal,
        list[CashFlowStatementLine],
    ]:
        opening_total = Decimal(
            "0.00",
        )

        closing_total = Decimal(
            "0.00",
        )

        cash_lines: list[
            CashFlowStatementLine
        ] = []

        cash_accounts = sorted(
            (
                account
                for account
                in account_lookup.values()
                if account.is_cash_equivalent
            ),
            key=lambda account: (
                account.display_order,
                account.account_code,
            ),
        )

        for account in cash_accounts:
            opening_balance = (
                self.natural_balance(
                    account,
                    money(
                        opening_debits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                    money(
                        opening_credits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                )
            )

            closing_balance = (
                self.natural_balance(
                    account,
                    money(
                        closing_debits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                    money(
                        closing_credits.get(
                            account.id,
                            Decimal("0.00"),
                        ),
                    ),
                )
            )

            opening_total += (
                opening_balance
            )

            closing_total += (
                closing_balance
            )

            cash_lines.append(
                self.create_line(
                    account,
                    closing_balance,
                ),
            )

        return (
            money(opening_total),
            money(closing_total),
            cash_lines,
        )