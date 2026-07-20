from collections.abc import Generator

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
    name: str = "Chart Test Company",
    business_type: str = "trading",
) -> dict[str, object]:
    response = client.post(
        "/api/companies",
        json={
            "name": name,
            "business_type": business_type,
            "default_currency": "GHS",
            "reporting_basis": "accrual",
        },
    )

    assert response.status_code == 201

    return response.json()


def initialize_chart(
    client: TestClient,
    company_id: str,
) -> dict[str, object]:
    response = client.post(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts/initialize"
        ),
    )

    assert response.status_code == 200

    return response.json()


def test_trading_chart_can_be_initialized(
    client: TestClient,
) -> None:
    company = create_company(
        client,
        business_type="trading",
    )

    result = initialize_chart(
        client,
        str(company["id"]),
    )

    assert result["created_count"] > 20
    assert result["skipped_count"] == 0
    assert result["business_template"] == "trading"

    account_names = {
        account["account_name"]
        for account in result["items"]
    }

    assert "Sales Revenue" in account_names
    assert "Purchases" in account_names
    assert "Inventory" in account_names
    assert "Bank Accounts" in account_names


def test_initialization_is_idempotent(
    client: TestClient,
) -> None:
    company = create_company(
        client,
    )

    first_result = initialize_chart(
        client,
        str(company["id"]),
    )

    second_result = initialize_chart(
        client,
        str(company["id"]),
    )

    assert first_result["created_count"] > 0
    assert second_result["created_count"] == 0
    assert second_result["skipped_count"] == (
        first_result["created_count"]
    )


def test_business_templates_are_different(
    client: TestClient,
) -> None:
    service_company = create_company(
        client,
        name="Service Company",
        business_type="service",
    )

    transport_company = create_company(
        client,
        name="Transport Company",
        business_type="transport_logistics",
    )

    service_result = initialize_chart(
        client,
        str(service_company["id"]),
    )

    transport_result = initialize_chart(
        client,
        str(transport_company["id"]),
    )

    service_names = {
        account["account_name"]
        for account in service_result["items"]
    }

    transport_names = {
        account["account_name"]
        for account in transport_result["items"]
    }

    assert "Service Revenue" in service_names
    assert "Subcontractor Costs" in service_names

    assert "Transport Income" in transport_names
    assert "Fuel and Lubricants" in transport_names

    assert "Transport Income" not in service_names


def test_custom_account_can_be_created_and_filtered(
    client: TestClient,
) -> None:
    company = create_company(
        client,
        business_type="service",
    )

    response = client.post(
        (
            f"/api/companies/{company['id']}"
            "/chart-of-accounts"
        ),
        json={
            "account_code": "7150",
            "account_name": "Software Subscriptions",
            "account_type": "expense",
            "report_category": (
                "administrative_expenses"
            ),
            "cash_flow_category": "operating",
            "normal_balance": "debit",
            "description": (
                "Cloud and software subscription costs."
            ),
            "display_order": 7150,
        },
    )

    assert response.status_code == 201

    created_account = response.json()

    assert (
        created_account["is_system_account"]
        is False
    )

    list_response = client.get(
        (
            f"/api/companies/{company['id']}"
            "/chart-of-accounts"
        ),
        params={
            "search": "software",
            "account_type": "expense",
        },
    )

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert (
        list_response.json()["items"][0][
            "account_code"
        ]
        == "7150"
    )


def test_duplicate_code_and_invalid_classification_are_rejected(
    client: TestClient,
) -> None:
    company = create_company(
        client,
    )

    initialize_chart(
        client,
        str(company["id"]),
    )

    duplicate_response = client.post(
        (
            f"/api/companies/{company['id']}"
            "/chart-of-accounts"
        ),
        json={
            "account_code": "1000",
            "account_name": "Duplicate Cash",
            "account_type": "asset",
            "report_category": "current_assets",
            "normal_balance": "debit",
        },
    )

    assert duplicate_response.status_code == 409

    invalid_response = client.post(
        (
            f"/api/companies/{company['id']}"
            "/chart-of-accounts"
        ),
        json={
            "account_code": "9998",
            "account_name": "Invalid Revenue",
            "account_type": "asset",
            "report_category": "revenue",
            "normal_balance": "debit",
        },
    )

    assert invalid_response.status_code == 400


def test_system_account_protection_and_deactivation(
    client: TestClient,
) -> None:
    company = create_company(
        client,
    )

    initialization = initialize_chart(
        client,
        str(company["id"]),
    )

    system_account = initialization["items"][0]
    account_id = str(system_account["id"])

    rename_response = client.patch(
        f"/api/ledger-accounts/{account_id}",
        json={
            "account_name": "Petty Cash",
        },
    )

    assert rename_response.status_code == 200
    assert (
        rename_response.json()["account_name"]
        == "Petty Cash"
    )

    protected_response = client.patch(
        f"/api/ledger-accounts/{account_id}",
        json={
            "account_code": "9999",
        },
    )

    assert protected_response.status_code == 400

    deactivate_response = client.patch(
        (
            f"/api/ledger-accounts/{account_id}"
            "/deactivate"
        ),
    )

    assert deactivate_response.status_code == 200
    assert (
        deactivate_response.json()["is_active"]
        is False
    )

    default_list_response = client.get(
        (
            f"/api/companies/{company['id']}"
            "/chart-of-accounts"
        ),
    )

    account_ids = {
        account["id"]
        for account in default_list_response.json()[
            "items"
        ]
    }

    assert account_id not in account_ids

    complete_list_response = client.get(
        (
            f"/api/companies/{company['id']}"
            "/chart-of-accounts"
        ),
        params={
            "include_inactive": True,
        },
    )

    complete_account_ids = {
        account["id"]
        for account in complete_list_response.json()[
            "items"
        ]
    }

    assert account_id in complete_account_ids