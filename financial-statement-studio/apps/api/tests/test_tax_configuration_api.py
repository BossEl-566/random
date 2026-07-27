from collections.abc import Generator
from decimal import Decimal

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
            "name":
                "Tax Configuration Company",
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
            "period_start": "2025-01-01",
            "period_end": "2025-12-31",
            "currency": "GHS",
        },
    )

    assert response.status_code == 201

    return response.json()


def create_profile(
    client: TestClient,
    company_id: str,
    *,
    profile_code: str,
    profile_name: str,
    is_default: bool = False,
) -> dict[str, object]:
    response = client.post(
        "/api/tax-profiles",
        json={
            "company_id": company_id,
            "profile_code": profile_code,
            "profile_name": profile_name,
            "jurisdiction_country_code":
                "GH",
            "jurisdiction_name":
                "Ghana",
            "is_default": is_default,
            "is_active": True,
        },
    )

    assert response.status_code == 201

    return response.json()


def create_percentage_rule(
    client: TestClient,
    profile_id: str,
    *,
    effective_from: str,
    effective_to: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "rule_code": "CIT-STANDARD",
        "rule_name":
            "Corporate Income Tax",
        "tax_type":
            "corporate_income_tax",
        "calculation_method":
            "percentage",
        "rate_percentage": "25.000000",
        "fixed_amount": None,
        "currency": "GHS",
        "effective_from":
            effective_from,
        "display_order": 10,
    }

    if effective_to is not None:
        payload["effective_to"] = (
            effective_to
        )

    response = client.post(
        (
            f"/api/tax-profiles/"
            f"{profile_id}/rules"
        ),
        json=payload,
    )

    assert response.status_code == 201

    return response.json()


def test_first_profile_becomes_default_and_default_can_change(
    client: TestClient,
) -> None:
    company = create_company(client)

    first_profile = create_profile(
        client,
        str(company["id"]),
        profile_code="PRIMARY",
        profile_name="Primary Profile",
    )

    assert (
        first_profile["is_default"]
        is True
    )

    second_profile = create_profile(
        client,
        str(company["id"]),
        profile_code="SECONDARY",
        profile_name="Secondary Profile",
        is_default=True,
    )

    assert (
        second_profile["is_default"]
        is True
    )

    list_response = client.get(
        (
            f"/api/companies/"
            f"{company['id']}"
            "/tax-profiles"
        ),
    )

    assert list_response.status_code == 200

    default_profiles = [
        profile
        for profile
        in list_response.json()["items"]
        if profile["is_default"]
    ]

    assert len(default_profiles) == 1

    assert (
        default_profiles[0]["id"]
        == second_profile["id"]
    )


def test_overlapping_rule_period_is_rejected(
    client: TestClient,
) -> None:
    company = create_company(client)

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="OVERLAP",
        profile_name="Overlap Profile",
    )

    create_percentage_rule(
        client,
        str(profile["id"]),
        effective_from="2025-01-01",
        effective_to="2025-12-31",
    )

    overlap_response = client.post(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}/rules"
        ),
        json={
            "rule_code":
                "CIT-STANDARD",
            "rule_name":
                "Overlapping Rule",
            "tax_type":
                "corporate_income_tax",
            "calculation_method":
                "percentage",
            "rate_percentage":
                "20.000000",
            "fixed_amount": None,
            "currency": "GHS",
            "effective_from":
                "2025-06-01",
            "effective_to":
                "2026-05-31",
        },
    )

    assert (
        overlap_response.status_code
        == 409
    )


def test_rule_can_be_activated_and_selected_by_date(
    client: TestClient,
) -> None:
    company = create_company(client)

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="EFFECTIVE",
        profile_name="Effective Profile",
    )

    rule = create_percentage_rule(
        client,
        str(profile["id"]),
        effective_from="2025-01-01",
    )

    activate_response = client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/activate"
        ),
    )

    assert activate_response.status_code == 200

    assert (
        activate_response.json()["status"]
        == "active"
    )

    effective_response = client.get(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}"
            "/rules/effective"
        ),
        params={
            "rule_code":
                "CIT-STANDARD",
            "calculation_date":
                "2025-12-31",
        },
    )

    assert effective_response.status_code == 200

    assert (
        effective_response.json()["id"]
        == rule["id"]
    )


def test_percentage_preview_and_audit_record(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="CALCULATION",
        profile_name="Calculation Profile",
    )

    rule = create_percentage_rule(
        client,
        str(profile["id"]),
        effective_from="2025-01-01",
    )

    assert client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/activate"
        ),
    ).status_code == 200

    calculation_payload = {
        "tax_profile_id":
            profile["id"],
        "rule_code":
            "CIT-STANDARD",
        "calculation_date":
            "2025-12-31",
        "tax_base": "100000.00",
    }

    preview_response = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/tax-calculations/preview"
        ),
        json=calculation_payload,
    )

    assert preview_response.status_code == 200

    preview = preview_response.json()

    assert Decimal(
        preview["tax_amount"],
    ) == Decimal("25000.00")

    record_response = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/tax-calculations"
        ),
        json=calculation_payload,
    )

    assert record_response.status_code == 201

    calculation = record_response.json()

    assert (
        calculation[
            "rule_code_snapshot"
        ]
        == "CIT-STANDARD"
    )

    assert Decimal(
        calculation["rate_applied"],
    ) == Decimal("25.000000")

    list_response = client.get(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/tax-calculations"
        ),
    )

    assert list_response.status_code == 200

    assert (
        list_response.json()["total"]
        == 1
    )


def test_fixed_amount_preview(
    client: TestClient,
) -> None:
    company = create_company(client)

    report = create_report(
        client,
        str(company["id"]),
    )

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="FIXED",
        profile_name="Fixed Profile",
    )

    rule_response = client.post(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}/rules"
        ),
        json={
            "rule_code":
                "FIXED-LEVY",
            "rule_name":
                "Fixed Levy",
            "tax_type": "levy",
            "calculation_method":
                "fixed_amount",
            "rate_percentage": None,
            "fixed_amount":
                "750.00",
            "currency": "GHS",
            "effective_from":
                "2025-01-01",
        },
    )

    assert rule_response.status_code == 201

    rule = rule_response.json()

    assert client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/activate"
        ),
    ).status_code == 200

    preview_response = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/tax-calculations/preview"
        ),
        json={
            "tax_profile_id":
                profile["id"],
            "rule_code":
                "FIXED-LEVY",
            "calculation_date":
                "2025-12-31",
            "tax_base": "50000.00",
        },
    )

    assert preview_response.status_code == 200

    assert Decimal(
        preview_response.json()[
            "tax_amount"
        ],
    ) == Decimal("750.00")


def test_active_rule_core_fields_are_locked(
    client: TestClient,
) -> None:
    company = create_company(client)

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="LOCKED",
        profile_name="Locked Rule Profile",
    )

    rule = create_percentage_rule(
        client,
        str(profile["id"]),
        effective_from="2025-01-01",
    )

    assert client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/activate"
        ),
    ).status_code == 200

    update_response = client.patch(
        (
            f"/api/tax-rules/"
            f"{rule['id']}"
        ),
        json={
            "rate_percentage":
                "30.000000",
        },
    )

    assert update_response.status_code == 409

    metadata_response = client.patch(
        (
            f"/api/tax-rules/"
            f"{rule['id']}"
        ),
        json={
            "notes":
                "Updated explanatory note.",
        },
    )

    assert metadata_response.status_code == 200


def test_retired_rule_remains_available_for_historical_date(
    client: TestClient,
) -> None:
    company = create_company(client)

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="HISTORY",
        profile_name="Historical Profile",
    )

    rule = create_percentage_rule(
        client,
        str(profile["id"]),
        effective_from="2025-01-01",
    )

    assert client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/activate"
        ),
    ).status_code == 200

    retire_response = client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/retire"
        ),
        json={
            "effective_to":
                "2025-12-31",
        },
    )

    assert retire_response.status_code == 200

    assert (
        retire_response.json()["status"]
        == "retired"
    )

    historical_response = client.get(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}"
            "/rules/effective"
        ),
        params={
            "rule_code":
                "CIT-STANDARD",
            "calculation_date":
                "2025-06-30",
        },
    )

    assert historical_response.status_code == 200

    future_response = client.get(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}"
            "/rules/effective"
        ),
        params={
            "rule_code":
                "CIT-STANDARD",
            "calculation_date":
                "2026-01-01",
        },
    )

    assert future_response.status_code == 404


def test_inactive_profile_cannot_supply_rules(
    client: TestClient,
) -> None:
    company = create_company(client)

    profile = create_profile(
        client,
        str(company["id"]),
        profile_code="INACTIVE",
        profile_name="Inactive Profile",
    )

    deactivate_response = client.post(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}/deactivate"
        ),
    )

    assert deactivate_response.status_code == 200

    create_rule_response = client.post(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}/rules"
        ),
        json={
            "rule_code":
                "INACTIVE-RULE",
            "rule_name":
                "Inactive Rule",
            "tax_type": "custom",
            "calculation_method":
                "percentage",
            "rate_percentage":
                "10.000000",
            "fixed_amount": None,
            "currency": "GHS",
            "effective_from":
                "2025-01-01",
        },
    )

    assert (
        create_rule_response.status_code
        == 400
    )