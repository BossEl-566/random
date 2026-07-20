from collections.abc import Generator
from datetime import date

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
    name: str = "Report Test Company",
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


def create_report(
    client: TestClient,
    company_id: str,
    *,
    period_start: str = "2025-01-01",
    period_end: str = "2025-12-31",
    comparison_report_id: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "company_id": company_id,
        "report_type": (
            "annual_financial_statements"
        ),
        "period_start": period_start,
        "period_end": period_end,
    }

    if comparison_report_id:
        payload["comparison_report_id"] = (
            comparison_report_id
        )

    response = client.post(
        "/api/financial-reports",
        json=payload,
    )

    assert response.status_code == 201

    return response.json()


def test_report_creation_uses_company_defaults(
    client: TestClient,
) -> None:
    company = create_company(
        client,
        business_type="trading",
    )

    report = create_report(
        client,
        str(company["id"]),
    )

    assert report["financial_year"] == 2025
    assert report["currency"] == "GHS"
    assert (
        report["business_template"]
        == "trading"
    )
    assert report["status"] == "draft"

    assert report["title"] == (
        "Financial Statements for the Year "
        "Ended 31 December 2025"
    )


def test_report_can_be_listed_read_and_updated(
    client: TestClient,
) -> None:
    company = create_company(
        client,
    )

    report = create_report(
        client,
        str(company["id"]),
    )

    report_id = str(report["id"])

    list_response = client.get(
        "/api/financial-reports",
        params={
            "company_id": company["id"],
        },
    )

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1

    read_response = client.get(
        f"/api/financial-reports/{report_id}",
    )

    assert read_response.status_code == 200

    update_response = client.patch(
        f"/api/financial-reports/{report_id}",
        json={
            "title": "Updated Annual Accounts",
            "period_end": "2026-12-31",
            "currency": "usd",
            "business_template": "service",
        },
    )

    assert update_response.status_code == 200

    updated_report = update_response.json()

    assert updated_report["title"] == (
        "Updated Annual Accounts"
    )
    assert updated_report["financial_year"] == 2026
    assert updated_report["currency"] == "USD"
    assert (
        updated_report["business_template"]
        == "service"
    )


def test_invalid_reporting_period_is_rejected(
    client: TestClient,
) -> None:
    company = create_company(
        client,
    )

    response = client.post(
        "/api/financial-reports",
        json={
            "company_id": company["id"],
            "period_start": "2025-12-31",
            "period_end": "2025-01-01",
        },
    )

    assert response.status_code == 422


def test_comparison_report_must_be_earlier_and_same_company(
    client: TestClient,
) -> None:
    first_company = create_company(
        client,
        name="First Company",
    )

    second_company = create_company(
        client,
        name="Second Company",
    )

    previous_report = create_report(
        client,
        str(first_company["id"]),
        period_start="2024-01-01",
        period_end="2024-12-31",
    )

    current_report = create_report(
        client,
        str(first_company["id"]),
        period_start="2025-01-01",
        period_end="2025-12-31",
        comparison_report_id=str(
            previous_report["id"],
        ),
    )

    assert (
        current_report[
            "comparison_report_id"
        ]
        == previous_report["id"]
    )

    wrong_company_response = client.post(
        "/api/financial-reports",
        json={
            "company_id": second_company["id"],
            "period_start": "2025-01-01",
            "period_end": "2025-12-31",
            "comparison_report_id": (
                previous_report["id"]
            ),
        },
    )

    assert (
        wrong_company_response.status_code
        == 400
    )

    later_comparison_response = client.post(
        "/api/financial-reports",
        json={
            "company_id": first_company["id"],
            "period_start": "2023-01-01",
            "period_end": "2023-12-31",
            "comparison_report_id": (
                previous_report["id"]
            ),
        },
    )

    assert (
        later_comparison_response.status_code
        == 400
    )


def test_report_cannot_be_created_for_inactive_company(
    client: TestClient,
) -> None:
    company = create_company(
        client,
    )

    deactivate_response = client.patch(
        (
            "/api/companies/"
            f"{company['id']}/deactivate"
        ),
    )

    assert deactivate_response.status_code == 200

    response = client.post(
        "/api/financial-reports",
        json={
            "company_id": company["id"],
            "period_start": "2025-01-01",
            "period_end": "2025-12-31",
        },
    )

    assert response.status_code == 409


def test_missing_report_and_empty_update_are_handled(
    client: TestClient,
) -> None:
    missing_response = client.get(
        "/api/financial-reports/missing-report",
    )

    assert missing_response.status_code == 404

    company = create_company(
        client,
    )

    report = create_report(
        client,
        str(company["id"]),
    )

    empty_update_response = client.patch(
        (
            "/api/financial-reports/"
            f"{report['id']}"
        ),
        json={},
    )

    assert (
        empty_update_response.status_code
        == 400
    )