from collections.abc import Generator

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
            "name": "Cash Flow Test Company",
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


def find_account(
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

    account = next(
        (
            item
            for item
            in response.json()["items"]
            if item["account_name"]
            == account_name
        ),
        None,
    )

    assert account is not None

    return account


def test_report_is_not_ready_without_cash_account(
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
            "/cash-flow-readiness"
        ),
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["is_ready"] is False
    assert (
        payload[
            "active_cash_account_count"
        ]
        == 0
    )

    warning_codes = {
        warning["code"]
        for warning
        in payload["warnings"]
    }

    assert (
        "NO_ACTIVE_CASH_ACCOUNT"
        in warning_codes
    )


def test_bank_account_can_be_marked_as_cash_equivalent(
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

    bank_account = find_account(
        client,
        str(company["id"]),
        "Bank Accounts",
    )

    update_response = client.patch(
        (
            "/api/ledger-accounts/"
            f"{bank_account['id']}"
        ),
        json={
            "is_cash_equivalent": True,
            "cash_flow_category": (
                "not_applicable"
            ),
        },
    )

    assert update_response.status_code == 200
    assert (
        update_response.json()[
            "is_cash_equivalent"
        ]
        is True
    )

    readiness_response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/cash-flow-readiness"
        ),
    )

    assert (
        readiness_response.status_code
        == 200
    )

    payload = readiness_response.json()

    assert (
        payload[
            "active_cash_account_count"
        ]
        == 1
    )

    assert (
        payload[
            "active_cash_accounts"
        ][0]["account_name"]
        == "Bank Accounts"
    )


def test_missing_report_returns_not_found(
    client: TestClient,
) -> None:
    response = client.get(
        (
            "/api/financial-reports/"
            "00000000-0000-0000-0000-000000000000"
            "/cash-flow-readiness"
        ),
    )

    assert response.status_code == 404