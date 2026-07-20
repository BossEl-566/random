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
    *,
    name: str = "Journal Test Company",
) -> dict[str, object]:
    response = client.post(
        "/api/companies",
        json={
            "name": name,
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


def get_account(
    client: TestClient,
    company_id: str,
    account_name: str,
) -> dict[str, object]:
    response = client.get(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts"
        ),
        params={
            "search": account_name,
            "limit": 500,
        },
    )

    assert response.status_code == 200

    accounts = response.json()["items"]

    matching_account = next(
        (
            account
            for account in accounts
            if account["account_name"]
            == account_name
        ),
        None,
    )

    assert matching_account is not None

    return matching_account


def create_opening_entry(
    client: TestClient,
    report_id: str,
    debit_account_id: str,
    credit_account_id: str,
    amount: str = "1000.00",
) -> dict[str, object]:
    response = client.post(
        (
            f"/api/financial-reports/{report_id}"
            "/journal-entries"
        ),
        json={
            "entry_date": "2025-01-01",
            "entry_type": "opening_balance",
            "description": "Opening capital introduced",
            "reference": "OPEN-001",
            "lines": [
                {
                    "ledger_account_id": (
                        debit_account_id
                    ),
                    "description": (
                        "Opening bank balance"
                    ),
                    "debit": amount,
                    "credit": "0.00",
                },
                {
                    "ledger_account_id": (
                        credit_account_id
                    ),
                    "description": (
                        "Opening owner's capital"
                    ),
                    "debit": "0.00",
                    "credit": amount,
                },
            ],
        },
    )

    assert response.status_code == 201

    return response.json()


def prepare_report_with_accounts(
    client: TestClient,
) -> tuple[
    dict[str, object],
    dict[str, object],
    dict[str, object],
    dict[str, object],
]:
    company = create_company(client)

    create_report_response = create_report(
        client,
        str(company["id"]),
    )

    initialize_chart(
        client,
        str(company["id"]),
    )

    bank_account = get_account(
        client,
        str(company["id"]),
        "Bank Accounts",
    )

    capital_account = get_account(
        client,
        str(company["id"]),
        "Owner's Capital",
    )

    return (
        company,
        create_report_response,
        bank_account,
        capital_account,
    )


def test_balanced_opening_entry_can_be_created(
    client: TestClient,
) -> None:
    (
        company,
        report,
        bank_account,
        capital_account,
    ) = prepare_report_with_accounts(
        client,
    )

    entry = create_opening_entry(
        client,
        str(report["id"]),
        str(bank_account["id"]),
        str(capital_account["id"]),
    )

    assert entry["company_id"] == company["id"]
    assert entry["status"] == "draft"
    assert entry["entry_type"] == "opening_balance"
    assert entry["entry_number"] == "OB-2025-0001"
    assert len(entry["lines"]) == 2

    assert Decimal(
        entry["total_debit"],
    ) == Decimal("1000.00")

    assert Decimal(
        entry["total_credit"],
    ) == Decimal("1000.00")


def test_unbalanced_entry_is_rejected(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        bank_account,
        capital_account,
    ) = prepare_report_with_accounts(
        client,
    )

    response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/journal-entries"
        ),
        json={
            "entry_date": "2025-02-01",
            "entry_type": "standard",
            "description": "Unbalanced transaction",
            "lines": [
                {
                    "ledger_account_id": (
                        bank_account["id"]
                    ),
                    "debit": "100.00",
                    "credit": "0.00",
                },
                {
                    "ledger_account_id": (
                        capital_account["id"]
                    ),
                    "debit": "0.00",
                    "credit": "90.00",
                },
            ],
        },
    )

    assert response.status_code == 422


def test_account_from_another_company_is_rejected(
    client: TestClient,
) -> None:
    (
        _first_company,
        first_report,
        first_bank,
        _first_capital,
    ) = prepare_report_with_accounts(
        client,
    )

    second_company = create_company(
        client,
        name="Second Journal Company",
    )

    initialize_chart(
        client,
        str(second_company["id"]),
    )

    second_capital = get_account(
        client,
        str(second_company["id"]),
        "Owner's Capital",
    )

    response = client.post(
        (
            f"/api/financial-reports/{first_report['id']}"
            "/journal-entries"
        ),
        json={
            "entry_date": "2025-03-01",
            "entry_type": "standard",
            "description": "Invalid company account",
            "lines": [
                {
                    "ledger_account_id": (
                        first_bank["id"]
                    ),
                    "debit": "500.00",
                    "credit": "0.00",
                },
                {
                    "ledger_account_id": (
                        second_capital["id"]
                    ),
                    "debit": "0.00",
                    "credit": "500.00",
                },
            ],
        },
    )

    assert response.status_code == 400


def test_posted_entry_appears_in_trial_balance(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        bank_account,
        capital_account,
    ) = prepare_report_with_accounts(
        client,
    )

    entry = create_opening_entry(
        client,
        str(report["id"]),
        str(bank_account["id"]),
        str(capital_account["id"]),
        amount="2500.00",
    )

    post_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/post"
        ),
    )

    assert post_response.status_code == 200
    assert (
        post_response.json()["status"]
        == "posted"
    )
    assert (
        post_response.json()["posted_at"]
        is not None
    )

    trial_balance_response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/trial-balance"
        ),
    )

    assert (
        trial_balance_response.status_code
        == 200
    )

    trial_balance = (
        trial_balance_response.json()
    )

    assert (
        trial_balance["posted_entry_count"]
        == 1
    )
    assert trial_balance["is_balanced"] is True

    assert Decimal(
        trial_balance["total_debit"],
    ) == Decimal("2500.00")

    assert Decimal(
        trial_balance["total_credit"],
    ) == Decimal("2500.00")


def test_posted_entry_cannot_be_edited(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        bank_account,
        capital_account,
    ) = prepare_report_with_accounts(
        client,
    )

    entry = create_opening_entry(
        client,
        str(report["id"]),
        str(bank_account["id"]),
        str(capital_account["id"]),
    )

    post_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/post"
        ),
    )

    assert post_response.status_code == 200

    update_response = client.patch(
        (
            f"/api/journal-entries/"
            f"{entry['id']}"
        ),
        json={
            "description": (
                "Attempted change after posting"
            ),
        },
    )

    assert update_response.status_code == 409


def test_opening_balance_requires_period_start_date(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        bank_account,
        capital_account,
    ) = prepare_report_with_accounts(
        client,
    )

    response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/journal-entries"
        ),
        json={
            "entry_date": "2025-01-02",
            "entry_type": "opening_balance",
            "description": "Invalid opening date",
            "lines": [
                {
                    "ledger_account_id": (
                        bank_account["id"]
                    ),
                    "debit": "100.00",
                    "credit": "0.00",
                },
                {
                    "ledger_account_id": (
                        capital_account["id"]
                    ),
                    "debit": "0.00",
                    "credit": "100.00",
                },
            ],
        },
    )

    assert response.status_code == 400


def test_voided_entry_is_removed_from_trial_balance(
    client: TestClient,
) -> None:
    (
        _company,
        report,
        bank_account,
        capital_account,
    ) = prepare_report_with_accounts(
        client,
    )

    entry = create_opening_entry(
        client,
        str(report["id"]),
        str(bank_account["id"]),
        str(capital_account["id"]),
    )

    post_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/post"
        ),
    )

    assert post_response.status_code == 200

    void_response = client.post(
        (
            f"/api/journal-entries/"
            f"{entry['id']}/void"
        ),
        json={
            "reason": (
                "Entry was posted to the wrong financial report."
            ),
        },
    )

    assert void_response.status_code == 200
    assert (
        void_response.json()["status"]
        == "voided"
    )
    assert (
        void_response.json()["void_reason"]
        is not None
    )

    trial_balance_response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/trial-balance"
        ),
    )

    assert (
        trial_balance_response.status_code
        == 200
    )

    trial_balance = (
        trial_balance_response.json()
    )

    assert (
        trial_balance["posted_entry_count"]
        == 0
    )

    assert Decimal(
        trial_balance["total_debit"],
    ) == Decimal("0.00")

    assert Decimal(
        trial_balance["total_credit"],
    ) == Decimal("0.00")

    assert trial_balance["items"] == []