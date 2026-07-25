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
                "Equity Statement Test Company"
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


def create_custom_equity_account(
    client: TestClient,
    company_id: str,
    *,
    account_code: str,
    account_name: str,
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
            "account_type": "equity",
            "report_category": "equity",
            "cash_flow_category": (
                "financing"
            ),
            "normal_balance": "credit",
            "display_order": display_order,
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


def debit_line(
    account_id: str,
    amount: str,
) -> dict[str, object]:
    return {
        "ledger_account_id": account_id,
        "debit": amount,
        "credit": "0.00",
    }


def credit_line(
    account_id: str,
    amount: str,
) -> dict[str, object]:
    return {
        "ledger_account_id": account_id,
        "debit": "0.00",
        "credit": amount,
    }


def prepare_report(
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

    drawings_account = (
        create_custom_equity_account(
            client,
            company_id,
            account_code="3997",
            account_name="Owner Drawings Test",
            display_order=3997,
        )
    )

    retained_earnings_account = (
        create_custom_equity_account(
            client,
            company_id,
            account_code="3998",
            account_name=(
                "Retained Earnings Test"
            ),
            display_order=3998,
        )
    )

    reserve_account = (
        create_custom_equity_account(
            client,
            company_id,
            account_code="3999",
            account_name=(
                "General Reserve Test"
            ),
            display_order=3999,
        )
    )

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
        {
            "Owner Drawings Test":
                drawings_account,
            "Retained Earnings Test":
                retained_earnings_account,
            "General Reserve Test":
                reserve_account,
        },
    )

    return (
        company,
        report,
        account_map,
    )


def test_statement_of_changes_in_equity_reconciles(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        accounts,
    ) = prepare_report(client)

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
        accounts[
            "Salaries and Wages"
        ]["id"],
    )

    drawings_id = str(
        accounts[
            "Owner Drawings Test"
        ]["id"],
    )

    retained_id = str(
        accounts[
            "Retained Earnings Test"
        ]["id"],
    )

    reserve_id = str(
        accounts[
            "General Reserve Test"
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
        description=(
            "Additional owner contribution"
        ),
        lines=[
            debit_line(
                bank_id,
                "2000.00",
            ),
            credit_line(
                capital_id,
                "2000.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-03-01",
        description="Owner drawings",
        lines=[
            debit_line(
                drawings_id,
                "500.00",
            ),
            credit_line(
                bank_id,
                "500.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-04-01",
        description="Reserve transfer",
        lines=[
            debit_line(
                retained_id,
                "300.00",
            ),
            credit_line(
                reserve_id,
                "300.00",
            ),
        ],
    )

    create_and_post_entry(
        client,
        report_id,
        entry_date="2025-05-01",
        description="Service revenue",
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
        entry_date="2025-06-01",
        description="Salary expense",
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

    response = client.get(
        (
            f"/api/financial-reports/{report_id}"
            "/statements/changes-in-equity"
        ),
    )

    assert response.status_code == 200

    statement = response.json()

    assert Decimal(
        statement[
            "opening_recorded_equity"
        ],
    ) == Decimal("10000.00")

    assert Decimal(
        statement[
            "direct_increases"
        ]["total"],
    ) == Decimal("2300.00")

    assert Decimal(
        statement[
            "direct_decreases"
        ]["total"],
    ) == Decimal("-800.00")

    assert Decimal(
        statement[
            "net_direct_equity_movement"
        ],
    ) == Decimal("1500.00")

    assert Decimal(
        statement[
            "profit_after_tax"
        ],
    ) == Decimal("4000.00")

    assert Decimal(
        statement[
            "recorded_closing_equity"
        ],
    ) == Decimal("11500.00")

    assert Decimal(
        statement[
            "total_closing_equity"
        ],
    ) == Decimal("15500.00")

    assert Decimal(
        statement[
            "equity_reconciliation_difference"
        ],
    ) == Decimal("0.00")

    assert statement[
        "is_reconciled"
    ] is True


def test_as_of_date_excludes_later_equity_movement(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        accounts,
    ) = prepare_report(client)

    report_id = str(
        report["id"],
    )

    bank_id = str(
        accounts["Bank Accounts"]["id"],
    )

    capital_id = str(
        accounts["Owner's Capital"]["id"],
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
        description="Later contribution",
        lines=[
            debit_line(
                bank_id,
                "2000.00",
            ),
            credit_line(
                capital_id,
                "2000.00",
            ),
        ],
    )

    response = client.get(
        (
            f"/api/financial-reports/{report_id}"
            "/statements/changes-in-equity"
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
            "opening_recorded_equity"
        ],
    ) == Decimal("5000.00")

    assert Decimal(
        statement[
            "net_direct_equity_movement"
        ],
    ) == Decimal("0.00")

    assert Decimal(
        statement[
            "total_closing_equity"
        ],
    ) == Decimal("5000.00")


def test_missing_report_returns_not_found(
    client: TestClient,
) -> None:
    response = client.get(
        (
            "/api/financial-reports/"
            "00000000-0000-0000-0000-000000000000"
            "/statements/changes-in-equity"
        ),
    )

    assert response.status_code == 404


def test_date_outside_report_period_is_rejected(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/changes-in-equity"
        ),
        params={
            "as_of": "2026-01-01",
        },
    )

    assert response.status_code == 400