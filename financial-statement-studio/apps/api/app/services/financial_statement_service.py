from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.financial_report import FinancialReport
from app.schemas.financial_statement import (
    FinancialStatementLine,
    FinancialStatementSection,
    ProfitOrLossResponse,
    StatementOfFinancialPositionResponse,
)
from app.schemas.journal_entry import (
    TrialBalanceLine,
    TrialBalanceResponse,
)
from app.services.journal_entry_service import (
    JournalEntryService,
    utc_now,
)


MONEY_QUANTUM = Decimal("0.01")


PROFIT_OR_LOSS_SECTION_TITLES = {
    "revenue": "Revenue",
    "cost_of_sales": "Cost of Sales",
    "direct_service_costs": "Direct Service Costs",
    "manufacturing_costs": "Manufacturing Costs",
    "other_income": "Other Income",
    "administrative_expenses": (
        "Administrative Expenses"
    ),
    "selling_distribution_expenses": (
        "Selling and Distribution Expenses"
    ),
    "finance_costs": "Finance Costs",
    "taxation": "Taxation",
}


FINANCIAL_POSITION_SECTION_TITLES = {
    "current_assets": "Current Assets",
    "non_current_assets": "Non-current Assets",
    "current_liabilities": "Current Liabilities",
    "non_current_liabilities": (
        "Non-current Liabilities"
    ),
    "equity": "Equity",
}


PROFIT_OR_LOSS_SECTION_ORDER = (
    "revenue",
    "cost_of_sales",
    "direct_service_costs",
    "manufacturing_costs",
    "other_income",
    "administrative_expenses",
    "selling_distribution_expenses",
    "finance_costs",
    "taxation",
)


FINANCIAL_POSITION_SECTION_ORDER = (
    "current_assets",
    "non_current_assets",
    "current_liabilities",
    "non_current_liabilities",
    "equity",
)


DEBIT_NATURE_ACCOUNT_TYPES = {
    "asset",
    "expense",
}


CREDIT_NATURE_ACCOUNT_TYPES = {
    "liability",
    "equity",
    "revenue",
}


def money(
    value: Decimal | int | str,
) -> Decimal:
    """
    Convert a value to a two-decimal-place accounting amount.
    """

    return Decimal(value).quantize(
        MONEY_QUANTUM,
    )


class FinancialStatementService:
    """
    Converts a posted Trial Balance into financial statements.
    """

    def __init__(
        self,
        journal_entry_service: JournalEntryService
        | None = None,
    ) -> None:
        self.journal_entry_service = (
            journal_entry_service
            or JournalEntryService()
        )

    def calculate_signed_amount(
        self,
        item: TrialBalanceLine,
    ) -> Decimal:
        """
        Return the account balance using the natural direction
        of its main account type.

        Assets and expenses normally carry debit balances.
        Liabilities, equity and revenue normally carry credit balances.

        This also correctly handles contra accounts:

        - Accumulated depreciation becomes a negative asset.
        - Sales returns become negative revenue.
        - Drawings become negative equity.
        - Purchase returns become negative cost of sales.
        """

        debit_balance = money(
            item.debit_balance,
        )

        credit_balance = money(
            item.credit_balance,
        )

        if (
            item.account_type
            in DEBIT_NATURE_ACCOUNT_TYPES
        ):
            return money(
                debit_balance
                - credit_balance,
            )

        if (
            item.account_type
            in CREDIT_NATURE_ACCOUNT_TYPES
        ):
            return money(
                credit_balance
                - debit_balance,
            )

        return money(
            debit_balance
            - credit_balance,
        )

    def create_statement_line(
        self,
        item: TrialBalanceLine,
    ) -> FinancialStatementLine:
        return FinancialStatementLine(
            ledger_account_id=(
                item.ledger_account_id
            ),
            account_code=item.account_code,
            account_name=item.account_name,
            report_category=(
                item.report_category
            ),
            amount=self.calculate_signed_amount(
                item,
            ),
            is_calculated=False,
        )

    def build_section(
        self,
        trial_balance: TrialBalanceResponse,
        *,
        category: str,
        title: str,
    ) -> FinancialStatementSection:
        lines = [
            self.create_statement_line(
                item,
            )
            for item in trial_balance.items
            if item.report_category
            == category
        ]

        total = money(
            sum(
                (
                    line.amount
                    for line in lines
                ),
                Decimal("0.00"),
            ),
        )

        return FinancialStatementSection(
            key=category,
            title=title,
            items=lines,
            total=total,
        )

    def build_sections(
        self,
        trial_balance: TrialBalanceResponse,
        *,
        section_order: tuple[str, ...],
        section_titles: dict[str, str],
    ) -> list[FinancialStatementSection]:
        return [
            self.build_section(
                trial_balance,
                category=category,
                title=section_titles[
                    category
                ],
            )
            for category in section_order
        ]

    def get_section_total(
        self,
        sections: list[
            FinancialStatementSection
        ],
        category: str,
    ) -> Decimal:
        section = next(
            (
                current_section
                for current_section in sections
                if current_section.key
                == category
            ),
            None,
        )

        if section is None:
            return money("0.00")

        return money(section.total)

    def calculate_profit_or_loss_from_trial_balance(
        self,
        financial_report: FinancialReport,
        trial_balance: TrialBalanceResponse,
    ) -> ProfitOrLossResponse:
        sections = self.build_sections(
            trial_balance,
            section_order=(
                PROFIT_OR_LOSS_SECTION_ORDER
            ),
            section_titles=(
                PROFIT_OR_LOSS_SECTION_TITLES
            ),
        )

        revenue = self.get_section_total(
            sections,
            "revenue",
        )

        cost_of_sales = (
            self.get_section_total(
                sections,
                "cost_of_sales",
            )
        )

        direct_service_costs = (
            self.get_section_total(
                sections,
                "direct_service_costs",
            )
        )

        manufacturing_costs = (
            self.get_section_total(
                sections,
                "manufacturing_costs",
            )
        )

        direct_costs = money(
            cost_of_sales
            + direct_service_costs
            + manufacturing_costs,
        )

        gross_profit = money(
            revenue
            - direct_costs,
        )

        other_income = (
            self.get_section_total(
                sections,
                "other_income",
            )
        )

        administrative_expenses = (
            self.get_section_total(
                sections,
                "administrative_expenses",
            )
        )

        selling_distribution_expenses = (
            self.get_section_total(
                sections,
                "selling_distribution_expenses",
            )
        )

        operating_profit = money(
            gross_profit
            + other_income
            - administrative_expenses
            - selling_distribution_expenses,
        )

        finance_costs = (
            self.get_section_total(
                sections,
                "finance_costs",
            )
        )

        profit_before_tax = money(
            operating_profit
            - finance_costs,
        )

        taxation = (
            self.get_section_total(
                sections,
                "taxation",
            )
        )

        profit_after_tax = money(
            profit_before_tax
            - taxation,
        )

        return ProfitOrLossResponse(
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
            period_end=trial_balance.as_of,
            sections=sections,
            revenue=revenue,
            direct_costs=direct_costs,
            gross_profit=gross_profit,
            other_income=other_income,
            administrative_expenses=(
                administrative_expenses
            ),
            selling_distribution_expenses=(
                selling_distribution_expenses
            ),
            operating_profit=(
                operating_profit
            ),
            finance_costs=finance_costs,
            profit_before_tax=(
                profit_before_tax
            ),
            taxation=taxation,
            profit_after_tax=(
                profit_after_tax
            ),
            generated_at=utc_now(),
        )

    def calculate_profit_or_loss(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date | None,
    ) -> ProfitOrLossResponse:
        financial_report = (
            self.journal_entry_service.get_report(
                database_session,
                report_id,
            )
        )

        trial_balance = (
            self.journal_entry_service.calculate_trial_balance(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )

        return (
            self.calculate_profit_or_loss_from_trial_balance(
                financial_report,
                trial_balance,
            )
        )

    def calculate_statement_of_financial_position(
        self,
        database_session: Session,
        *,
        report_id: str,
        as_of: date | None,
    ) -> StatementOfFinancialPositionResponse:
        financial_report = (
            self.journal_entry_service.get_report(
                database_session,
                report_id,
            )
        )

        trial_balance = (
            self.journal_entry_service.calculate_trial_balance(
                database_session,
                report_id=report_id,
                as_of=as_of,
            )
        )

        profit_or_loss = (
            self.calculate_profit_or_loss_from_trial_balance(
                financial_report,
                trial_balance,
            )
        )

        sections = self.build_sections(
            trial_balance,
            section_order=(
                FINANCIAL_POSITION_SECTION_ORDER
            ),
            section_titles=(
                FINANCIAL_POSITION_SECTION_TITLES
            ),
        )

        current_assets = (
            self.get_section_total(
                sections,
                "current_assets",
            )
        )

        non_current_assets = (
            self.get_section_total(
                sections,
                "non_current_assets",
            )
        )

        total_assets = money(
            current_assets
            + non_current_assets,
        )

        current_liabilities = (
            self.get_section_total(
                sections,
                "current_liabilities",
            )
        )

        non_current_liabilities = (
            self.get_section_total(
                sections,
                "non_current_liabilities",
            )
        )

        total_liabilities = money(
            current_liabilities
            + non_current_liabilities,
        )

        equity_section = next(
            section
            for section in sections
            if section.key == "equity"
        )

        recorded_equity = money(
            equity_section.total,
        )

        current_year_profit = money(
            profit_or_loss.profit_after_tax,
        )

        equity_section.items.append(
            FinancialStatementLine(
                ledger_account_id=None,
                account_code=None,
                account_name=(
                    "Current Year Profit"
                    if current_year_profit
                    >= Decimal("0.00")
                    else "Current Year Loss"
                ),
                report_category="equity",
                amount=current_year_profit,
                is_calculated=True,
            ),
        )

        total_equity = money(
            recorded_equity
            + current_year_profit,
        )

        equity_section.total = total_equity

        total_liabilities_and_equity = money(
            total_liabilities
            + total_equity,
        )

        accounting_equation_difference = money(
            total_assets
            - total_liabilities_and_equity,
        )

        return StatementOfFinancialPositionResponse(
            financial_report_id=(
                financial_report.id
            ),
            company_id=(
                financial_report.company_id
            ),
            currency=(
                financial_report.currency
            ),
            as_of=trial_balance.as_of,
            sections=sections,
            current_assets=current_assets,
            non_current_assets=(
                non_current_assets
            ),
            total_assets=total_assets,
            current_liabilities=(
                current_liabilities
            ),
            non_current_liabilities=(
                non_current_liabilities
            ),
            total_liabilities=(
                total_liabilities
            ),
            recorded_equity=(
                recorded_equity
            ),
            current_year_profit=(
                current_year_profit
            ),
            total_equity=total_equity,
            total_liabilities_and_equity=(
                total_liabilities_and_equity
            ),
            accounting_equation_difference=(
                accounting_equation_difference
            ),
            is_balanced=(
                accounting_equation_difference
                == Decimal("0.00")
            ),
            generated_at=utc_now(),
        )