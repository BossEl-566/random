from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import (
    create_engine,
    event,
)
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
            "name": "Notes Test Company",
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
            "report_type":
                "annual_financial_statements",
            "period_start": "2025-01-01",
            "period_end": "2025-12-31",
        },
    )

    assert response.status_code == 201

    return response.json()


def test_system_templates_initialize_idempotently(
    client: TestClient,
) -> None:
    first_response = client.post(
        "/api/disclosure-templates/initialize",
    )

    assert first_response.status_code == 200

    first_payload = first_response.json()

    assert first_payload[
        "created_count"
    ] > 0

    second_response = client.post(
        "/api/disclosure-templates/initialize",
    )

    assert second_response.status_code == 200

    second_payload = (
        second_response.json()
    )

    assert second_payload[
        "created_count"
    ] == 0

    assert second_payload[
        "skipped_count"
    ] == len(
        second_payload["items"],
    )


def test_report_notes_initialize_with_automatic_numbers(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    template_response = client.post(
        "/api/disclosure-templates/initialize",
    )

    assert template_response.status_code == 200

    response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes/initialize"
        ),
        json={
            "include_optional": False,
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["created_count"] > 0

    note_numbers = [
        note["note_number"]
        for note in payload["items"]
    ]

    assert note_numbers == list(
        range(
            1,
            len(note_numbers) + 1,
        ),
    )

    second_response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes/initialize"
        ),
        json={
            "include_optional": False,
        },
    )

    assert second_response.status_code == 200

    assert second_response.json()[
        "created_count"
    ] == 0


def test_custom_note_receives_next_number(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    first_response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes"
        ),
        json={
            "title": "First note",
            "note_type":
                "general_disclosure",
            "content": "First content",
        },
    )

    assert first_response.status_code == 201

    second_response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes"
        ),
        json={
            "title": "Second note",
            "note_type":
                "general_disclosure",
            "content": "Second content",
        },
    )

    assert second_response.status_code == 201

    assert first_response.json()[
        "note_number"
    ] == 1

    assert second_response.json()[
        "note_number"
    ] == 2


def test_statement_line_requires_statement_name(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes"
        ),
        json={
            "title": "Invalid reference",
            "note_type":
                "general_disclosure",
            "statement_line_key":
                "revenue",
            "content": "Invalid",
        },
    )

    assert response.status_code == 400


def test_active_notes_can_be_reordered(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    note_ids: list[str] = []

    for title in [
        "First",
        "Second",
        "Third",
    ]:
        response = client.post(
            (
                f"/api/financial-reports/{report['id']}"
                "/notes"
            ),
            json={
                "title": title,
                "note_type":
                    "general_disclosure",
                "content": title,
            },
        )

        assert response.status_code == 201

        note_ids.append(
            response.json()["id"],
        )

    reorder_response = client.patch(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes/reorder"
        ),
        json={
            "note_ids": [
                note_ids[2],
                note_ids[0],
                note_ids[1],
            ],
        },
    )

    assert reorder_response.status_code == 200

    items = reorder_response.json()[
        "items"
    ]

    assert [
        item["title"]
        for item in items
    ] == [
        "Third",
        "First",
        "Second",
    ]

    assert [
        item["note_number"]
        for item in items
    ] == [1, 2, 3]


def test_note_can_be_deactivated_and_reactivated(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    create_response = client.post(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes"
        ),
        json={
            "title": "Status note",
            "note_type":
                "general_disclosure",
            "content": "Status test",
        },
    )

    assert create_response.status_code == 201

    note_id = create_response.json()["id"]

    deactivate_response = client.post(
        (
            f"/api/financial-report-notes/"
            f"{note_id}/deactivate"
        ),
    )

    assert deactivate_response.status_code == 200

    assert deactivate_response.json()[
        "is_active"
    ] is False

    active_list_response = client.get(
        (
            f"/api/financial-reports/{report['id']}"
            "/notes"
        ),
    )

    assert active_list_response.status_code == 200

    assert active_list_response.json()[
        "total"
    ] == 0

    reactivate_response = client.post(
        (
            f"/api/financial-report-notes/"
            f"{note_id}/reactivate"
        ),
    )

    assert reactivate_response.status_code == 200

    assert reactivate_response.json()[
        "is_active"
    ] is True


def test_missing_report_returns_not_found(
    client: TestClient,
) -> None:
    response = client.get(
        (
            "/api/financial-reports/"
            "00000000-0000-0000-0000-000000000000"
            "/notes"
        ),
    )

    assert response.status_code == 404