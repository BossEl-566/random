from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class FinancialStatementLine(BaseModel):
    """
    One ledger account displayed in a financial statement section.
    """

    ledger_account_id: str | None
    account_code: str | None
    account_name: str
    report_category: str

    amount: Decimal

    is_calculated: bool = False


class FinancialStatementSection(BaseModel):
    """
    A grouped financial-statement section.

    Examples:
    - Current assets
    - Revenue
    - Administrative expenses
    """

    key: str
    title: str

    items: list[FinancialStatementLine]

    total: Decimal


class ProfitOrLossResponse(BaseModel):
    """
    Calculated Statement of Profit or Loss.
    """

    financial_report_id: str
    company_id: str
    currency: str

    period_start: date
    period_end: date

    sections: list[FinancialStatementSection]

    revenue: Decimal
    direct_costs: Decimal
    gross_profit: Decimal

    other_income: Decimal

    administrative_expenses: Decimal
    selling_distribution_expenses: Decimal

    operating_profit: Decimal

    finance_costs: Decimal
    profit_before_tax: Decimal

    taxation: Decimal
    profit_after_tax: Decimal

    generated_at: datetime


class StatementOfFinancialPositionResponse(BaseModel):
    """
    Calculated Statement of Financial Position.
    """

    financial_report_id: str
    company_id: str
    currency: str

    as_of: date

    sections: list[FinancialStatementSection]

    current_assets: Decimal
    non_current_assets: Decimal
    total_assets: Decimal

    current_liabilities: Decimal
    non_current_liabilities: Decimal
    total_liabilities: Decimal

    recorded_equity: Decimal
    current_year_profit: Decimal
    total_equity: Decimal

    total_liabilities_and_equity: Decimal

    accounting_equation_difference: Decimal
    is_balanced: bool

    generated_at: datetime