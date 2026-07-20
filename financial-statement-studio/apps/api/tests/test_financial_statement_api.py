from collections.abc import Generator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models as _registered_models
from app.core.database import Base, get_db
from app.main import app


def enable_test_foreign_keys(
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
    test_engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
    )

    event.listen(
        test_engine,
        "connect",
        enable_test_foreign_keys,
    )

    session_factory = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    Base.metadata.create_all(
        test_engine,
    )

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

    Base.metadata.drop_all(
        test_engine,
    )


def create_company(
    client: TestClient,
) -> dict[str, object]:
    response = client.post(
        "/api/companies",
        json={
            "name": (
                "Financial Statement Test Company"
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


def get_accounts(
    client: TestClient,
    company_id: str,
) -> dict[str, dict[str, object]]:
    response = client.get(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts"
        ),
        params={
            "limit": 500,
        },
    )

    assert response.status_code == 200

    return {
        account["account_name"]: account
        for account in response.json()[
            "items"
        ]
    }


def create_entry(
    client: TestClient,
    *,
    report_id: str,
    entry_date: str,
    description: str,
    debit_account_id: str,
    credit_account_id: str,
    amount: str,
    entry_type: str = "standard",
    post: bool = True,
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
            "lines": [
                {
                    "ledger_account_id": (
                        debit_account_id
                    ),
                    "debit": amount,
                    "credit": "0.00",
                },
                {
                    "ledger_account_id": (
                        credit_account_id
                    ),
                    "debit": "0.00",
                    "credit": amount,
                },
            ],
        },
    )

    assert create_response.status_code == 201

    entry = create_response.json()

    if not post:
        return entry

    post_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/post"
        ),
    )

    assert post_response.status_code == 200

    return post_response.json()


def prepare_report(
    client: TestClient,
) -> tuple[
    dict[str, object],
    dict[str, object],
    dict[str, dict[str, object]],
]:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    initialize_chart(
        client,
        str(company["id"]),
    )

    accounts = get_accounts(
        client,
        str(company["id"]),
    )

    return company, report, accounts


def add_complete_accounting_activity(
    client: TestClient,
    report: dict[str, object],
    accounts: dict[
        str,
        dict[str, object],
    ],
) -> None:
    report_id = str(report["id"])

    bank_id = str(
        accounts["Bank Accounts"]["id"],
    )

    create_entry(
        client,
        report_id=report_id,
        entry_date="2025-01-01",
        entry_type="opening_balance",
        description="Opening capital",
        debit_account_id=bank_id,
        credit_account_id=str(
            accounts["Owner's Capital"][
                "id"
            ],
        ),
        amount="10000.00",
    )

    create_entry(
        client,
        report_id=report_id,
        entry_date="2025-03-10",
        description="Service income",
        debit_account_id=bank_id,
        credit_account_id=str(
            accounts["Service Revenue"][
                "id"
            ],
        ),
        amount="5000.00",
    )

    create_entry(
        client,
        report_id=report_id,
        entry_date="2025-04-15",
        description="Direct labour",
        debit_account_id=str(
            accounts["Direct Labour"][
                "id"
            ],
        ),
        credit_account_id=bank_id,
        amount="1800.00",
    )

    create_entry(
        client,
        report_id=report_id,
        entry_date="2025-05-20",
        description="Administrative salaries",
        debit_account_id=str(
            accounts["Salaries and Wages"][
                "id"
            ],
        ),
        credit_account_id=bank_id,
        amount="700.00",
    )

    create_entry(
        client,
        report_id=report_id,
        entry_date="2025-06-18",
        description="Loan interest",
        debit_account_id=str(
            accounts["Finance Costs"][
                "id"
            ],
        ),
        credit_account_id=bank_id,
        amount="200.00",
    )

    create_entry(
        client,
        report_id=report_id,
        entry_date="2025-12-15",
        description="Income tax paid",
        debit_account_id=str(
            accounts["Income Tax Expense"][
                "id"
            ],
        ),
        credit_account_id=bank_id,
        amount="300.00",
    )


def test_profit_or_loss_is_calculated_from_posted_entries(
    client: TestClient,
) -> None:
    _company, report, accounts = (
        prepare_report(client)
    )

    add_complete_accounting_activity(
        client,
        report,
        accounts,
    )

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/profit-or-loss"
        ),
    )

    assert response.status_code == 200

    statement = response.json()

    assert Decimal(
        statement["revenue"],
    ) == Decimal("5000.00")

    assert Decimal(
        statement["direct_costs"],
    ) == Decimal("1800.00")

    assert Decimal(
        statement["gross_profit"],
    ) == Decimal("3200.00")

    assert Decimal(
        statement[
            "administrative_expenses"
        ],
    ) == Decimal("700.00")

    assert Decimal(
        statement["operating_profit"],
    ) == Decimal("2500.00")

    assert Decimal(
        statement["finance_costs"],
    ) == Decimal("200.00")

    assert Decimal(
        statement["profit_before_tax"],
    ) == Decimal("2300.00")

    assert Decimal(
        statement["taxation"],
    ) == Decimal("300.00")

    assert Decimal(
        statement["profit_after_tax"],
    ) == Decimal("2000.00")


def test_financial_position_includes_current_year_profit(
    client: TestClient,
) -> None:
    _company, report, accounts = (
        prepare_report(client)
    )

    add_complete_accounting_activity(
        client,
        report,
        accounts,
    )

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/financial-position"
        ),
    )

    assert response.status_code == 200

    statement = response.json()

    assert Decimal(
        statement["total_assets"],
    ) == Decimal("12000.00")

    assert Decimal(
        statement["total_liabilities"],
    ) == Decimal("0.00")

    assert Decimal(
        statement["recorded_equity"],
    ) == Decimal("10000.00")

    assert Decimal(
        statement["current_year_profit"],
    ) == Decimal("2000.00")

    assert Decimal(
        statement["total_equity"],
    ) == Decimal("12000.00")

    assert Decimal(
        statement[
            "total_liabilities_and_equity"
        ],
    ) == Decimal("12000.00")

    assert Decimal(
        statement[
            "accounting_equation_difference"
        ],
    ) == Decimal("0.00")

    assert statement["is_balanced"] is True

def test_draft_entries_are_excluded(
    client: TestClient,
) -> None:
    _company, report, accounts = (
        prepare_report(client)
    )

    create_entry(
        client,
        report_id=str(report["id"]),
        entry_date="2025-03-10",
        description="Unposted service income",
        debit_account_id=str(
            accounts["Bank Accounts"]["id"],
        ),
        credit_account_id=str(
            accounts["Service Revenue"][
                "id"
            ],
        ),
        amount="4000.00",
        post=False,
    )

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/profit-or-loss"
        ),
    )

    assert response.status_code == 200

    statement = response.json()

    assert Decimal(
        statement["revenue"],
    ) == Decimal("0.00")

    assert Decimal(
        statement["profit_after_tax"],
    ) == Decimal("0.00")


def test_voided_entries_are_excluded(
    client: TestClient,
) -> None:
    _company, report, accounts = (
        prepare_report(client)
    )

    entry = create_entry(
        client,
        report_id=str(report["id"]),
        entry_date="2025-03-10",
        description="Service income to void",
        debit_account_id=str(
            accounts["Bank Accounts"]["id"],
        ),
        credit_account_id=str(
            accounts["Service Revenue"][
                "id"
            ],
        ),
        amount="4000.00",
    )

    void_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/void"
        ),
        json={
            "reason": (
                "Transaction was entered in the wrong report."
            ),
        },
    )

    assert void_response.status_code == 200

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/profit-or-loss"
        ),
    )

    assert response.status_code == 200

    statement = response.json()

    assert Decimal(
        statement["revenue"],
    ) == Decimal("0.00")

    assert Decimal(
        statement["profit_after_tax"],
    ) == Decimal("0.00")


def test_as_of_date_excludes_later_entries(
    client: TestClient,
) -> None:
    _company, report, accounts = (
        prepare_report(client)
    )

    bank_id = str(
        accounts["Bank Accounts"]["id"],
    )

    create_entry(
        client,
        report_id=str(report["id"]),
        entry_date="2025-03-10",
        description="Early service income",
        debit_account_id=bank_id,
        credit_account_id=str(
            accounts["Service Revenue"][
                "id"
            ],
        ),
        amount="5000.00",
    )

    create_entry(
        client,
        report_id=str(report["id"]),
        entry_date="2025-09-10",
        description="Later salary expense",
        debit_account_id=str(
            accounts["Salaries and Wages"][
                "id"
            ],
        ),
        credit_account_id=bank_id,
        amount="1000.00",
    )

    response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/statements/profit-or-loss"
        ),
        params={
            "as_of": "2025-06-30",
        },
    )

    assert response.status_code == 200

    statement = response.json()

    assert statement["period_end"] == (
        "2025-06-30"
    )

    assert Decimal(
        statement["revenue"],
    ) == Decimal("5000.00")

    assert Decimal(
        statement[
            "administrative_expenses"
        ],
    ) == Decimal("0.00")

    assert Decimal(
        statement["profit_after_tax"],
    ) == Decimal("5000.00")