from collections.abc import (
    Generator,
)
import json
from datetime import date
from decimal import Decimal
from hashlib import sha256

import pytest
from fastapi.testclient import (
    TestClient,
)
from sqlalchemy import (
    create_engine,
    event,
    func,
    select,
)
from sqlalchemy.orm import (
    Session,
    sessionmaker,
)
from sqlalchemy.pool import StaticPool

import app.models as _registered_models
from app.core.database import (
    Base,
    get_db,
)
from app.main import app
from app.models.financial_report_note import (
    FinancialReportNote,
)
from app.models.journal_entry import (
    JournalEntry,
)
from app.models.journal_line import (
    JournalLine,
)
from app.models.ledger_account import (
    LedgerAccount,
)
from app.models.mixins import utc_now
from app.models.tax_calculation import (
    TaxCalculation,
)


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
def test_context() -> Generator[
    tuple[
        TestClient,
        sessionmaker,
    ],
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

    with TestClient(app) as client:
        yield (
            client,
            session_factory,
        )

    app.dependency_overrides.clear()

    Base.metadata.drop_all(engine)


def create_company_and_report(
    client: TestClient,
) -> tuple[
    dict[str, object],
    dict[str, object],
]:
    company_response = client.post(
        "/api/companies",
        json={
            "name":
                "Finalisation Test Company",
            "business_type": "service",
            "default_currency": "GHS",
            "reporting_basis": "accrual",
        },
    )

    assert (
        company_response.status_code
        == 201
    )

    company = company_response.json()

    report_response = client.post(
        "/api/financial-reports",
        json={
            "company_id": company["id"],
            "report_type":
                "annual_financial_statements",
            "period_start": "2025-01-01",
            "period_end": "2025-12-31",
            "accountant_report_text": (
                "The financial statements "
                "were prepared from the "
                "entity's accounting records."
            ),
        },
    )

    assert (
        report_response.status_code
        == 201
    )

    return (
        company,
        report_response.json(),
    )


def seed_balanced_report(
    session_factory: sessionmaker,
    *,
    company_id: str,
    report_id: str,
) -> None:
    database_session = (
        session_factory()
    )

    try:
        bank_account = LedgerAccount(
            company_id=company_id,
            account_code="1000",
            account_name="Bank",
            account_type="asset",
            report_category=(
                "current_assets"
            ),
            cash_flow_category=(
                "operating"
            ),
            normal_balance="debit",
            is_system_account=False,
            is_cash_equivalent=True,
            is_active=True,
            display_order=10,
        )

        capital_account = LedgerAccount(
            company_id=company_id,
            account_code="3000",
            account_name="Owner's Capital",
            account_type="equity",
            report_category="equity",
            cash_flow_category=(
                "financing"
            ),
            normal_balance="credit",
            is_system_account=False,
            is_cash_equivalent=False,
            is_active=True,
            display_order=20,
        )

        database_session.add_all(
            [
                bank_account,
                capital_account,
            ],
        )

        database_session.flush()

        entry = JournalEntry(
            company_id=company_id,
            financial_report_id=(
                report_id
            ),
            sequence_number=1,
            entry_number=(
                "JE-2025-0001"
            ),
            entry_date=date(
                2025,
                1,
                1,
            ),
            entry_type="standard",
            status="posted",
            source="manual",
            description=(
                "Initial capital contribution"
            ),
            reference="CAP-001",
            posted_at=utc_now(),
            lines=[
                JournalLine(
                    ledger_account_id=(
                        bank_account.id
                    ),
                    line_number=1,
                    description=(
                        "Cash received"
                    ),
                    debit="10000.00",
                    credit="0.00",
                ),
                JournalLine(
                    ledger_account_id=(
                        capital_account.id
                    ),
                    line_number=2,
                    description=(
                        "Capital introduced"
                    ),
                    debit="0.00",
                    credit="10000.00",
                ),
            ],
        )

        note = FinancialReportNote(
            financial_report_id=(
                report_id
            ),
            template_id=None,
            note_number=1,
            title=(
                "Basis of Preparation"
            ),
            note_type=(
                "accounting_policy"
            ),
            statement_name=None,
            statement_line_key=None,
            content=(
                "Prepared using the "
                "accrual basis."
            ),
            is_active=True,
        )

        database_session.add(entry)
        database_session.add(note)

        database_session.commit()
    finally:
        database_session.close()


def finalise_report(
    client: TestClient,
    report_id: str,
):
    return client.post(
        (
            f"/api/financial-reports/"
            f"{report_id}/finalise"
        ),
        json={
            "accountant_name":
                "Test Accountant",
            "finalised_by":
                "Finance Manager",
            "approval_notes":
                "Approved for issue.",
        },
    )


def test_empty_report_is_not_ready(
    test_context,
) -> None:
    client, _ = test_context

    _, report = (
        create_company_and_report(
            client,
        )
    )

    response = client.get(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/finalisation-readiness"
        ),
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["can_finalise"]
        is False
    )

    blocker_codes = {
        blocker["code"]
        for blocker
        in payload["blockers"]
    }

    assert (
        "no_posted_entries"
        in blocker_codes
    )


def test_report_can_be_finalised_and_snapshotted(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    readiness_response = client.get(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/finalisation-readiness"
        ),
    )

    assert (
        readiness_response.status_code
        == 200
    )

    assert (
        readiness_response.json()[
            "can_finalise"
        ]
        is True
    )

    response = finalise_report(
        client,
        str(report["id"]),
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["report_status"]
        == "finalised"
    )

    assert (
        payload["revision_number"]
        == 1
    )

    checksum = payload["version"][
        "snapshot_checksum"
    ]

    assert len(checksum) == 64

    version_response = client.get(
        (
            "/api/financial-report-versions/"
            f"{payload['version']['id']}"
        ),
    )

    assert (
        version_response.status_code
        == 200
    )

    version_payload = (
        version_response.json()
    )

    assert sha256(
        version_payload[
            "snapshot_json"
        ].encode(
            "utf-8",
        ),
    ).hexdigest() == (
        version_payload[
            "snapshot_checksum"
        ]
    )

    assert (
        version_payload["snapshot"][
            "financial_report"
        ]["status"]
        == "finalised"
    )


def test_finalised_report_metadata_and_notes_are_locked(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    finalise_response = (
        finalise_report(
            client,
            str(report["id"]),
        )
    )

    assert (
        finalise_response.status_code
        == 200
    )

    report_update = client.patch(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
        ),
        json={
            "title":
                "Changed after finalisation",
        },
    )

    assert (
        report_update.status_code
        == 409
    )

    note_create = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}/notes"
        ),
        json={
            "title": "Late note",
            "note_type":
                "general_disclosure",
            "content":
                "Should not be accepted.",
        },
    )

    assert (
        note_create.status_code
        == 409
    )


def test_finalised_report_cannot_be_finalised_twice(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    first_response = (
        finalise_report(
            client,
            str(report["id"]),
        )
    )

    assert (
        first_response.status_code
        == 200
    )

    second_response = (
        finalise_report(
            client,
            str(report["id"]),
        )
    )

    assert (
        second_response.status_code
        in {
            400,
            409,
        }
    )


def test_revision_copies_journals_and_notes(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    finalise_response = (
        finalise_report(
            client,
            str(report["id"]),
        )
    )

    assert (
        finalise_response.status_code
        == 200
    )

    revision_response = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}/revisions"
        ),
        json={
            "revision_reason": (
                "Correct a disclosure "
                "and add an adjusting entry."
            ),
        },
    )

    assert (
        revision_response.status_code
        == 201
    )

    revision = (
        revision_response.json()
    )

    assert (
        revision["status"]
        == "draft"
    )

    assert (
        revision["revision_number"]
        == 2
    )

    assert (
        revision[
            "supersedes_report_id"
        ]
        == report["id"]
    )

    database_session = (
        session_factory()
    )

    try:
        copied_entry_count = (
            database_session.scalar(
                select(
                    func.count(),
                )
                .select_from(
                    JournalEntry,
                )
                .where(
                    JournalEntry
                    .financial_report_id
                    == revision["id"],
                ),
            )
            or 0
        )

        copied_note_count = (
            database_session.scalar(
                select(
                    func.count(),
                )
                .select_from(
                    FinancialReportNote,
                )
                .where(
                    FinancialReportNote
                    .financial_report_id
                    == revision["id"],
                ),
            )
            or 0
        )
    finally:
        database_session.close()

    assert copied_entry_count == 1
    assert copied_note_count == 1


def test_only_one_direct_revision_can_be_created(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    assert finalise_report(
        client,
        str(report["id"]),
    ).status_code == 200

    first_revision = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}/revisions"
        ),
        json={
            "revision_reason":
                "First revision.",
        },
    )

    assert (
        first_revision.status_code
        == 201
    )

    second_revision = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}/revisions"
        ),
        json={
            "revision_reason":
                "Duplicate revision.",
        },
    )

    assert (
        second_revision.status_code
        == 409
    )

def configure_report_tax(
    client: TestClient,
    *,
    company_id: str,
    report_id: str,
) -> dict[str, object]:
    chart_response = client.post(
        (
            f"/api/companies/{company_id}"
            "/chart-of-accounts/initialize"
        ),
    )

    assert chart_response.status_code == 200

    profile_response = client.post(
        "/api/tax-profiles",
        json={
            "company_id": company_id,
            "profile_code":
                "FINALISATION-TAX",
            "profile_name":
                "Finalisation Tax Profile",
            "jurisdiction_country_code":
                "GH",
            "jurisdiction_name":
                "Ghana",
            "is_default": True,
            "is_active": True,
        },
    )

    assert (
        profile_response.status_code
        == 201
    )

    profile = profile_response.json()

    rule_response = client.post(
        (
            f"/api/tax-profiles/"
            f"{profile['id']}/rules"
        ),
        json={
            "rule_code":
                "CIT-FINALISATION",
            "rule_name":
                "Finalisation Income Tax",
            "tax_type":
                "corporate_income_tax",
            "calculation_method":
                "percentage",
            "rate_percentage":
                "25.000000",
            "fixed_amount": None,
            "currency": "GHS",
            "effective_from":
                "2025-01-01",
            "effective_to": None,
            "display_order": 10,
        },
    )

    assert rule_response.status_code == 201

    rule = rule_response.json()

    activation_response = client.post(
        (
            f"/api/tax-rules/"
            f"{rule['id']}/activate"
        ),
    )

    assert (
        activation_response.status_code
        == 200
    )

    calculation_response = client.post(
        (
            f"/api/financial-reports/"
            f"{report_id}"
            "/tax-calculations"
        ),
        json={
            "tax_profile_id":
                profile["id"],
            "rule_code":
                "CIT-FINALISATION",
            "calculation_date":
                "2025-12-31",
            "tax_base": "1000.00",
        },
    )

    assert (
        calculation_response.status_code
        == 201
    )

    return calculation_response.json()


def test_tax_readiness_and_snapshot_are_preserved(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    calculation = configure_report_tax(
        client,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    readiness_response = client.get(
        (
            f"/api/financial-reports/"
            f"{report['id']}"
            "/finalisation-readiness"
        ),
    )

    assert (
        readiness_response.status_code
        == 200
    )

    readiness = readiness_response.json()

    assert readiness[
        "tax_calculation_count"
    ] == 1

    assert readiness[
        "draft_tax_calculation_count"
    ] == 1

    assert (
        readiness[
            "tax_reconciliation_status"
        ]
        == "under_posted"
    )

    assert readiness[
        "can_finalise"
    ] is True

    warning_codes = {
        warning["code"]
        for warning
        in readiness["warnings"]
    }

    assert (
        "draft_tax_calculations"
        in warning_codes
    )

    assert (
        "tax_under_posted"
        in warning_codes
    )

    finalise_response = finalise_report(
        client,
        str(report["id"]),
    )

    assert (
        finalise_response.status_code
        == 200
    )

    version_id = (
        finalise_response.json()[
            "version"
        ]["id"]
    )

    version_response = client.get(
        (
            "/api/financial-report-versions/"
            f"{version_id}"
        ),
    )

    assert (
        version_response.status_code
        == 200
    )

    snapshot = version_response.json()[
        "snapshot"
    ]

    assert (
        snapshot[
            "snapshot_format_version"
        ]
        == 2
    )

    assert len(
        snapshot["tax_calculations"],
    ) == 1

    assert (
        snapshot[
            "tax_calculations"
        ][0]["id"]
        == calculation["id"]
    )

    assert (
        snapshot[
            "tax_reconciliation"
        ]["status"]
        == "under_posted"
    )

    assert (
        snapshot[
            "tax_reconciliation"
        ]["difference"]
        == "250.00"
    )


def test_revision_copies_tax_calculations(
    test_context,
) -> None:
    client, session_factory = (
        test_context
    )

    company, report = (
        create_company_and_report(
            client,
        )
    )

    seed_balanced_report(
        session_factory,
        company_id=str(
            company["id"],
        ),
        report_id=str(
            report["id"],
        ),
    )

    source_calculation = (
        configure_report_tax(
            client,
            company_id=str(
                company["id"],
            ),
            report_id=str(
                report["id"],
            ),
        )
    )

    assert finalise_report(
        client,
        str(report["id"]),
    ).status_code == 200

    revision_response = client.post(
        (
            f"/api/financial-reports/"
            f"{report['id']}/revisions"
        ),
        json={
            "revision_reason":
                "Review the tax calculation.",
        },
    )

    assert (
        revision_response.status_code
        == 201
    )

    revision = revision_response.json()

    database_session = (
        session_factory()
    )

    try:
        copied_calculations = list(
            database_session.scalars(
                select(
                    TaxCalculation,
                )
                .where(
                    TaxCalculation
                    .financial_report_id
                    == revision["id"],
                ),
            ).all(),
        )
    finally:
        database_session.close()

    assert len(copied_calculations) == 1

    copied_calculation = (
        copied_calculations[0]
    )

    assert (
        copied_calculation.tax_amount
        == Decimal("250.00")
    )

    assert (
        copied_calculation.status
        == "draft"
    )

    assert (
        copied_calculation.tax_rule_id
        == source_calculation[
            "tax_rule_id"
        ]
    )

    copied_details = json.loads(
        copied_calculation
        .calculation_details_json
        or "{}",
    )

    assert (
        copied_details[
            "copied_from_tax_calculation_id"
        ]
        == source_calculation["id"]
    )

    assert (
        copied_details[
            "copied_from_report_id"
        ]
        == report["id"]
    )