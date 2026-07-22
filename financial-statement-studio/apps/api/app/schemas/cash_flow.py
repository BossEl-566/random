from datetime import datetime

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