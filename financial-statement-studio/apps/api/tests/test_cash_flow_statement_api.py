from collections.abc import Generator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import (
    Session,
    sessionmaker,
)
from sqlalchemy.pool import StaticPool

import app.models as _registered_models
from app.core.database import Base, get_db
from app.main import app


def enable_foreign_keys(
    dbapi_connection: object,
    connection_record: object,
) -> None:
    del connection_record

    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]

    try:
        cursor.execute(
            "PRAGMA foreign_keys=ON",
        )
    finally:
        cursor.close()


@pytest.fixture()
def client() -> Generator[
    TestClient,
    None,
    None,
]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
    )

    event.listen(
        engine,
        "connect",
        enable_foreign_keys,
    )

    session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    Base.metadata.create_all(engine)

    def override_get_db() -> Generator[
        Session,
        None,
        None,
    ]:
        database_session = (
            session_factory()
        )

        try:
            yield database_session
        finally:
            database_session.close()

    app.dependency_overrides[get_db] = (
        override_get_db
    )

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()

    Base.metadata.drop_all(engine)


def create_company(
    client: TestClient,
) -> dict[str, object]:
    response = client.post(
        "/api/companies",
        json={
            "name": (
                "Cash Flow Statement Test Company"
            ),
            "business_type": "service",
            "default_currency": "GHS",
            "reporting_basis": "accrual",
        },
    )

    assert response.status_code == 201

    return response.json()


def create_report(
    client: TestClient,
    company_id: str,
) -> dict[str, object]:
    response = client.post(
        "/api/financial-reports",
        json={
            "company_id": company_id,
            "report_type": (
                "annual_financial_statements"
            ),
            "period_start": "2025-01-01",
            "period_end": "2025-12-31",
        },
    )

    assert response.status_code == 201

    return response.json()


def initialize_chart(
    client: TestClient,
    company_id: str,
) -> None:
    response = client.post(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts/initialize"
        ),
    )

    assert response.status_code == 200


def list_accounts(
    client: TestClient,
    company_id: str,
) -> list[dict[str, object]]:
    response = client.get(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts"
        ),
        params={
            "include_inactive": True,
            "limit": 500,
        },
    )

    assert response.status_code == 200

    return response.json()["items"]


def find_account(
    accounts: list[
        dict[str, object]
    ],
    account_name: str,
) -> dict[str, object]:
    account = next(
        (
            current_account
            for current_account in accounts
            if current_account[
                "account_name"
            ]
            == account_name
        ),
        None,
    )

    assert account is not None

    return account


def update_account(
    client: TestClient,
    account_id: str,
    payload: dict[str, object],
) -> dict[str, object]:
    response = client.patch(
        (
            "/api/ledger-accounts/"
            f"{account_id}"
        ),
        json=payload,
    )

    assert response.status_code == 200

    return response.json()


def create_custom_account(
    client: TestClient,
    company_id: str,
    *,
    account_code: str,
    account_name: str,
    account_type: str,
    report_category: str,
    cash_flow_category: str,
    normal_balance: str,
    display_order: int,
) -> dict[str, object]:
    response = client.post(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts"
        ),
        json={
            "account_code": account_code,
            "account_name": account_name,
            "account_type": account_type,
            "report_category": (
                report_category
            ),
            "cash_flow_category": (
                cash_flow_category
            ),
            "normal_balance": (
                normal_balance
            ),
            "display_order": (
                display_order
            ),
            "is_cash_equivalent": False,
        },
    )

    assert response.status_code == 201

    return response.json()


def create_and_post_entry(
    client: TestClient,
    report_id: str,
    *,
    entry_date: str,
    description: str,
    lines: list[
        dict[str, object]
    ],
    entry_type: str = "standard",
) -> dict[str, object]:
    create_response = client.post(
        (
            f"/api/financial-reports/{report_id}"
            "/journal-entries"
        ),
        json={
            "entry_date": entry_date,
            "entry_type": entry_type,
            "source": "manual",
            "description": description,
            "lines": lines,
        },
    )

    assert create_response.status_code == 201

    entry = create_response.json()

    post_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/post"
        ),
    )

    assert post_response.status_code == 200

    return post_response.json()


def prepare_ready_report(
    client: TestClient,
) -> tuple[
    dict[str, object],
    dict[str, object],
    dict[str, dict[str, object]],
]:
    company = create_company(client)

    company_id = str(
        company["id"],
    )

    report = create_report(
        client,
        company_id,
    )

    initialize_chart(
        client,
        company_id,
    )

    accounts = list_accounts(
        client,
        company_id,
    )

    for account in accounts:
        if (
            account[
                "cash_flow_category"
            ]
            is None
        ):
            update_account(
                client,
                str(account["id"]),
                {
                    "cash_flow_category": (
                        "operating"
                    ),
                },
            )

    accounts = list_accounts(
        client,
        company_id,
    )

    bank_account = find_account(
        accounts,
        "Bank Accounts",
    )

    update_account(
        client,
        str(bank_account["id"]),
        {
            "is_cash_equivalent": True,
            "cash_flow_category": (
                "not_applicable"
            ),
        },
    )

    custom_accounts = {
        "Trade Receivables Test":
            create_custom_account(
                client,
                company_id,
                account_code="1199",
                account_name=(
                    "Trade Receivables Test"
                ),
                account_type="asset",
                report_category=(
                    "current_assets"
                ),
                cash_flow_category=(
                    "operating"
                ),
                normal_balance="debit",
                display_order=1199,
            ),
        "Equipment Test":
            create_custom_account(
                client,
                company_id,
                account_code="1599",
                account_name=(
                    "Equipment Test"
                ),
                account_type="asset",
                report_category=(
                    "non_current_assets"
                ),
                cash_flow_category=(
                    "investing"
                ),
                normal_balance="debit",
                display_order=1599,
            ),
        "Long-term Loan Test":
            create_custom_account(
                client,
                company_id,
                account_code="2599",
                account_name=(
                    "Long-term Loan Test"
                ),
                account_type="liability",
                report_category=(
                    "non_current_liabilities"
                ),
                cash_flow_category=(
                    "financing"
                ),
                normal_balance="credit",
                display_order=2599,
            ),
        "Non-cash Expense Test":
            create_custom_account(
                client,
                company_id,
                account_code="7998",
                account_name=(
                    "Non-cash Expense Test"
                ),
                account_type="expense",
                report_category=(
                    "administrative_expenses"
                ),
                cash_flow_category=(
                    "non_cash"
                ),
                normal_balance="debit",
                display_order=7998,
            ),
        "Non-cash Reserve Test":
            create_custom_account(
                client,
                company_id,
                account_code="3998",
                account_name=(
                    "Non-cash Reserve Test"
                ),
                account_type="equity",
                report_category="equity",
                cash_flow_category=(
                    "non_cash"
                ),
                normal_balance="credit",
                display_order=3998,
            ),
    }

    accounts = list_accounts(
        client,
        company_id,
    )

    account_map = {
        str(account["account_name"]):
            account
        for account in accounts
    }

    account_map.update(
        custom_accounts,
    )

    return (
        company,
        report,
        account_map,
    )


def debit_line(
    account_id: str,
    amount: str,
) -> dict[str, object]:
    return {
        "ledger_account_id": (
            account_id
        ),
        "debit": amount,
        "credit": "0.00",
    }


def credit_line(
    account_id: str,
    amount: str,
) -> dict[str, object]:
    return {
        "ledger_account_id": (
            account_id
        ),
        "debit": "0.00",
        "credit": amount,
    }


def test_indirect_cash_flow_statement_reconciles(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        accounts,
    ) = prepare_ready_report(
        client,
    )

    report_id = str(
        report["id"],
    )

    bank_id = str(
        accounts["Bank Accounts"]["id"],
    )

    capital_id = str(
        accounts["Owner's Capital"]["id"],
    )

    revenue_id = str(
        accounts["Service Revenue"]["id"],
    )

    salary_id = str(
        accounts["Salaries and Wages"]["id"],
    )

    receivable_id = str(
        accounts[
            "Trade Receivables Test"
        ]["id"],
    )

    equipment_id = str(
        accounts["Equipment Test"]["id"],
    )

    loan_id = str(
        accounts[
            "Long-term Loan Test"
        ]["id"],
    )

    non_cash_expense_id = str(
        accounts[
            "Non-cash Expense Test"
        ]["id"],
    )

    non_cash_reserve_id = str(
        accounts[
            "Non-cash Reserve Test"
        ]["id"],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-01-01",
        entry_type="opening_balance",
        description="Opening capital",
        lines=[
            debit_line(
                bank_id,
                "10000.00",
            ),
            credit_line(
                capital_id,
                "10000.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-02-01",
        description="Cash service income",
        lines=[
            debit_line(
                bank_id,
                "5000.00",
            ),
            credit_line(
                revenue_id,
                "5000.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-03-01",
        description="Credit service income",
        lines=[
            debit_line(
                receivable_id,
                "500.00",
            ),
            credit_line(
                revenue_id,
                "500.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-04-01",
        description="Salary paid",
        lines=[
            debit_line(
                salary_id,
                "1000.00",
            ),
            credit_line(
                bank_id,
                "1000.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-05-01",
        description="Non-cash expense",
        lines=[
            debit_line(
                non_cash_expense_id,
                "300.00",
            ),
            credit_line(
                non_cash_reserve_id,
                "300.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-06-01",
        description="Equipment purchased",
        lines=[
            debit_line(
                equipment_id,
                "2000.00",
            ),
            credit_line(
                bank_id,
                "2000.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-07-01",
        description="Loan received",
        lines=[
            debit_line(
                bank_id,
                "3000.00",
            ),
            credit_line(
                loan_id,
                "3000.00",
            ),
        ],
    )

    response = client.get(
        (
            f"/api/financial-reports/{report_id}"
            "/statements/cash-flows"
        ),
    )

    assert response.status_code == 200

    statement = response.json()

    assert Decimal(
        statement["profit_after_tax"],
    ) == Decimal("4200.00")

    assert Decimal(
        statement[
            "non_cash_adjustments"
        ]["total"],
    ) == Decimal("300.00")

    assert Decimal(
        statement[
            "working_capital_adjustments"
        ]["total"],
    ) == Decimal("-500.00")

    assert Decimal(
        statement[
            "net_cash_from_operating_activities"
        ],
    ) == Decimal("4000.00")

    assert Decimal(
        statement[
            "net_cash_from_investing_activities"
        ],
    ) == Decimal("-2000.00")

    assert Decimal(
        statement[
            "net_cash_from_financing_activities"
        ],
    ) == Decimal("3000.00")

    assert Decimal(
        statement[
            "net_increase_decrease_in_cash"
        ],
    ) == Decimal("5000.00")

    assert Decimal(
        statement[
            "opening_cash_balance"
        ],
    ) == Decimal("10000.00")

    assert Decimal(
        statement[
            "calculated_closing_cash"
        ],
    ) == Decimal("15000.00")

    assert Decimal(
        statement[
            "closing_cash_balance"
        ],
    ) == Decimal("15000.00")

    assert Decimal(
        statement[
            "cash_reconciliation_difference"
        ],
    ) == Decimal("0.00")

    assert statement[
        "is_reconciled"
    ] is True


def test_cash_flow_statement_requires_readiness(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    initialize_chart(
        client,
        str(company["id"]),
    )

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/cash-flows"
        ),
    )

    assert response.status_code == 409


def test_cash_flow_as_of_date_excludes_later_activity(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        accounts,
    ) = prepare_ready_report(
        client,
    )

    report_id = str(
        report["id"],
    )

    bank_id = str(
        accounts["Bank Accounts"]["id"],
    )

    capital_id = str(
        accounts["Owner's Capital"]["id"],
    )

    equipment_id = str(
        accounts["Equipment Test"]["id"],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-01-01",
        entry_type="opening_balance",
        description="Opening cash",
        lines=[
            debit_line(
                bank_id,
                "5000.00",
            ),
            credit_line(
                capital_id,
                "5000.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-09-01",
        description="Later equipment purchase",
        lines=[
            debit_line(
                equipment_id,
                "1000.00",
            ),
            credit_line(
                bank_id,
                "1000.00",
            ),
        ],
    )

    response = client.get(
        (
            f"/api/financial-reports/{report_id}"
            "/statements/cash-flows"
        ),
        params={
            "as_of": "2025-06-30",
        },
    )

    assert response.status_code == 200

    statement = response.json()

    assert statement[
        "period_end"
    ] == "2025-06-30"

    assert Decimal(
        statement[
            "net_cash_from_investing_activities"
        ],
    ) == Decimal("0.00")

    assert Decimal(
        statement[
            "closing_cash_balance"
        ],
    ) == Decimal("5000.00")

    assert statement[
        "is_reconciled"
    ] is True