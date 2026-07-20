from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models as _registered_models
from app.core.database import Base, get_db
from app.main import app

import app.models
from app.core.database import Base, get_db
from app.main import app




def enable_test_foreign_keys(
    dbapi_connection: object,
    connection_record: object,
) -> None:
    """Enable SQLite foreign-key checks in the test database."""

    del connection_record

    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]

    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
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

    testing_session_factory = sessionmaker(
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
        database_session = testing_session_factory()

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


def company_payload(
    name: str = "Test Logistics Company",
) -> dict[str, object]:
    return {
        "name": name,
        "business_type": "transport_logistics",
        "registration_number": "CS123456",
        "tin": "P0001234567",
        "address": "Accra, Ghana",
        "telephone": "+233200000000",
        "email": "accounts@example.com",
        "default_currency": "ghs",
        "reporting_basis": "accrual",
    }


def create_company(
    client: TestClient,
    name: str = "Test Logistics Company",
) -> dict[str, object]:
    response = client.post(
        "/api/companies",
        json=company_payload(name),
    )

    assert response.status_code == 201

    return response.json()


def test_company_can_be_created_and_listed(
    client: TestClient,
) -> None:
    created_company = create_company(
        client,
    )

    assert created_company["name"] == (
        "Test Logistics Company"
    )
    assert created_company["business_type"] == (
        "transport_logistics"
    )
    assert created_company["default_currency"] == "GHS"
    assert created_company["is_active"] is True
    assert len(created_company["id"]) == 36

    response = client.get(
        "/api/companies",
    )

    assert response.status_code == 200

    response_body = response.json()

    assert response_body["total"] == 1
    assert response_body["offset"] == 0
    assert response_body["limit"] == 50
    assert len(response_body["items"]) == 1
    assert response_body["items"][0]["id"] == (
        created_company["id"]
    )


def test_company_can_be_read_and_updated(
    client: TestClient,
) -> None:
    created_company = create_company(
        client,
    )

    company_id = created_company["id"]

    read_response = client.get(
        f"/api/companies/{company_id}",
    )

    assert read_response.status_code == 200
    assert read_response.json()["name"] == (
        "Test Logistics Company"
    )

    update_response = client.patch(
        f"/api/companies/{company_id}",
        json={
            "name": "Updated Logistics Ghana",
            "business_type": "service",
            "email": "finance@example.com",
        },
    )

    assert update_response.status_code == 200

    updated_company = update_response.json()

    assert updated_company["name"] == (
        "Updated Logistics Ghana"
    )
    assert updated_company["business_type"] == "service"
    assert updated_company["email"] == (
        "finance@example.com"
    )
    assert updated_company["tin"] == (
        "P0001234567"
    )


def test_deactivated_company_is_hidden_from_default_list(
    client: TestClient,
) -> None:
    created_company = create_company(
        client,
    )

    company_id = created_company["id"]

    deactivate_response = client.patch(
        f"/api/companies/{company_id}/deactivate",
    )

    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False

    active_list_response = client.get(
        "/api/companies",
    )

    assert active_list_response.status_code == 200
    assert active_list_response.json()["total"] == 0
    assert active_list_response.json()["items"] == []

    complete_list_response = client.get(
        "/api/companies",
        params={
            "include_inactive": True,
        },
    )

    assert complete_list_response.status_code == 200
    assert complete_list_response.json()["total"] == 1
    assert (
        complete_list_response.json()["items"][0][
            "is_active"
        ]
        is False
    )


def test_company_search_filters_results(
    client: TestClient,
) -> None:
    create_company(
        client,
        "Alpha Logistics",
    )

    create_company(
        client,
        "Beta Trading",
    )

    response = client.get(
        "/api/companies",
        params={
            "search": "alpha",
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["name"] == (
        "Alpha Logistics"
    )


def test_invalid_company_payload_is_rejected(
    client: TestClient,
) -> None:
    invalid_name_response = client.post(
        "/api/companies",
        json={
            "name": " ",
        },
    )

    assert invalid_name_response.status_code == 422

    invalid_email_response = client.post(
        "/api/companies",
        json={
            "name": "Email Test Company",
            "email": "not-an-email",
        },
    )

    assert invalid_email_response.status_code == 422

    invalid_currency_response = client.post(
        "/api/companies",
        json={
            "name": "Currency Test Company",
            "default_currency": "CEDIS",
        },
    )

    assert invalid_currency_response.status_code == 422


def test_missing_company_and_empty_update_are_handled(
    client: TestClient,
) -> None:
    missing_response = client.get(
        "/api/companies/company-does-not-exist",
    )

    assert missing_response.status_code == 404

    created_company = create_company(
        client,
    )

    empty_update_response = client.patch(
        (
            "/api/companies/"
            f"{created_company['id']}"
        ),
        json={},
    )

    assert empty_update_response.status_code == 400
    assert empty_update_response.json()["detail"] == (
        "Provide at least one company field to update."
    )