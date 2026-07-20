from fastapi import APIRouter

from app.api.routes.companies import (
    router as companies_router,
)
from app.api.routes.financial_reports import (
    router as financial_reports_router,
)
from app.api.routes.health import (
    router as health_router,
)
from app.api.routes.ledger_accounts import (
    company_chart_router,
    ledger_account_router,
)
from app.api.routes.journal_entries import (
    journal_entry_router,
    report_journal_router,
)


api_router = APIRouter()

api_router.include_router(
    health_router,
    prefix="/health",
    tags=["Health"],
)

api_router.include_router(
    companies_router,
    prefix="/companies",
    tags=["Companies"],
)

api_router.include_router(
    financial_reports_router,
    prefix="/financial-reports",
    tags=["Financial Reports"],
)

api_router.include_router(
    company_chart_router,
    prefix="/companies/{company_id}/chart-of-accounts",
    tags=["Chart of Accounts"],
)

api_router.include_router(
    ledger_account_router,
    prefix="/ledger-accounts",
    tags=["Ledger Accounts"],
)

api_router.include_router(
    report_journal_router,
    prefix="/financial-reports/{report_id}",
    tags=[
        "Journal Entries",
        "Trial Balance",
    ],
)

api_router.include_router(
    journal_entry_router,
    prefix="/journal-entries",
    tags=["Journal Entries"],
)