from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class CashFlowReadinessAccount(BaseModel):
    id: str
    account_code: str
    account_name: str
    report_category: str
    cash_flow_category: str | None
    is_cash_equivalent: bool
    is_active: bool


class CashFlowReadinessWarning(BaseModel):
    code: str
    message: str
    ledger_account_id: str | None = None


class CashFlowReadinessResponse(BaseModel):
    financial_report_id: str
    company_id: str

    is_ready: bool

    active_cash_account_count: int

    active_cash_accounts: list[
        CashFlowReadinessAccount
    ]

    warnings: list[
        CashFlowReadinessWarning
    ]

    generated_at: datetime


class CashFlowStatementLine(BaseModel):
    """
    One account movement shown in the Statement of Cash Flows.
    """

    ledger_account_id: str | None
    account_code: str | None
    account_name: str
    amount: Decimal


class CashFlowStatementSection(BaseModel):
    """
    One grouped section in the Statement of Cash Flows.
    """

    key: str
    title: str

    items: list[
        CashFlowStatementLine
    ]

    total: Decimal


class StatementOfCashFlowsResponse(BaseModel):
    """
    Indirect-method Statement of Cash Flows.
    """

    financial_report_id: str
    company_id: str
    currency: str

    period_start: date
    period_end: date

    profit_after_tax: Decimal

    non_cash_adjustments: CashFlowStatementSection
    working_capital_adjustments: CashFlowStatementSection

    net_cash_from_operating_activities: Decimal

    investing_activities: CashFlowStatementSection
    net_cash_from_investing_activities: Decimal

    financing_activities: CashFlowStatementSection
    net_cash_from_financing_activities: Decimal

    net_increase_decrease_in_cash: Decimal

    opening_cash_balance: Decimal
    calculated_closing_cash: Decimal
    closing_cash_balance: Decimal

    cash_accounts: list[
        CashFlowStatementLine
    ]

    cash_reconciliation_difference: Decimal
    is_reconciled: bool

    generated_at: datetime