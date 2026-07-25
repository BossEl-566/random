from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class EquityMovementLine(BaseModel):
    ledger_account_id: str
    account_code: str
    account_name: str

    opening_balance: Decimal
    direct_increases: Decimal
    direct_decreases: Decimal
    net_direct_movement: Decimal
    recorded_closing_balance: Decimal


class EquityMovementSectionLine(BaseModel):
    ledger_account_id: str
    account_code: str
    account_name: str
    amount: Decimal


class EquityMovementSection(BaseModel):
    key: str
    title: str

    items: list[
        EquityMovementSectionLine
    ]

    total: Decimal


class StatementOfChangesInEquityResponse(
    BaseModel,
):
    financial_report_id: str
    company_id: str
    currency: str

    period_start: date
    period_end: date

    opening_recorded_equity: Decimal

    direct_increases: EquityMovementSection
    direct_decreases: EquityMovementSection

    net_direct_equity_movement: Decimal

    profit_after_tax: Decimal

    recorded_closing_equity: Decimal
    total_closing_equity: Decimal

    equity_accounts: list[
        EquityMovementLine
    ]

    calculated_recorded_closing_equity: Decimal

    equity_reconciliation_difference: Decimal

    is_reconciled: bool

    generated_at: datetime