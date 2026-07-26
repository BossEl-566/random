from collections.abc import Generator
from datetime import date
from hashlib import sha256

import pytest
from sqlalchemy import (
    create_engine,
    event,
    func,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    Session,
    sessionmaker,
)
from sqlalchemy.pool import StaticPool

import app.models as _registered_models
from app.core.database import Base
from app.models.company import Company
from app.models.financial_report import (
    FinancialReport,
)
from app.models.financial_report_version import (
    FinancialReportVersion,
)
from app.models.mixins import utc_now


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
def database_session() -> Generator[
    Session,
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

    session = session_factory()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def create_report(
    database_session: Session,
) -> FinancialReport:
    company = Company(
        name="Version Test Company",
        business_type="service",
        default_currency="GHS",
        reporting_basis="accrual",
    )

    database_session.add(company)
    database_session.flush()

    report = FinancialReport(
        company_id=company.id,
        revision_series_id=None,
        revision_number=1,
        supersedes_report_id=None,
        revision_reason=None,
        title="Financial Statements 2025",
        report_type=(
            "annual_financial_statements"
        ),
        period_start=date(
            2025,
            1,
            1,
        ),
        period_end=date(
            2025,
            12,
            31,
        ),
        financial_year=2025,
        currency="GHS",
        business_template="service",
        status="draft",
    )

    database_session.add(report)
    database_session.commit()
    database_session.refresh(report)

    return report


def create_version(
    database_session: Session,
    report: FinancialReport,
) -> FinancialReportVersion:
    snapshot_json = (
        '{"report":{"status":"finalised"}}'
    )

    version = FinancialReportVersion(
        financial_report_id=report.id,
        revision_series_id=report.id,
        revision_number=1,
        finalised_at=utc_now(),
        finalised_by="Finance Manager",
        accountant_name="Test Accountant",
        approval_notes="Approved for issue.",
        snapshot_json=snapshot_json,
        snapshot_checksum=sha256(
            snapshot_json.encode(
                "utf-8",
            ),
        ).hexdigest(),
    )

    database_session.add(version)
    database_session.commit()
    database_session.refresh(version)

    return version


def test_finalised_version_can_be_stored(
    database_session: Session,
) -> None:
    report = create_report(
        database_session,
    )

    version = create_version(
        database_session,
        report,
    )

    assert (
        version.financial_report_id
        == report.id
    )

    assert version.revision_number == 1

    assert len(
        version.snapshot_checksum,
    ) == 64

    assert (
        version.financial_report.id
        == report.id
    )


def test_only_one_final_version_is_allowed_per_report(
    database_session: Session,
) -> None:
    report = create_report(
        database_session,
    )

    create_version(
        database_session,
        report,
    )

    second_snapshot = (
        '{"report":{"status":"changed"}}'
    )

    duplicate = FinancialReportVersion(
        financial_report_id=report.id,
        revision_series_id=report.id,
        revision_number=2,
        finalised_at=utc_now(),
        finalised_by="Second Approver",
        accountant_name="Second Accountant",
        approval_notes=None,
        snapshot_json=second_snapshot,
        snapshot_checksum=sha256(
            second_snapshot.encode(
                "utf-8",
            ),
        ).hexdigest(),
    )

    database_session.add(duplicate)

    with pytest.raises(
        IntegrityError,
    ):
        database_session.commit()

    database_session.rollback()


def test_report_deletion_cascades_to_version(
    database_session: Session,
) -> None:
    report = create_report(
        database_session,
    )

    create_version(
        database_session,
        report,
    )

    report_id = report.id

    database_session.delete(report)
    database_session.commit()

    version_count = (
        database_session.scalar(
            select(
                func.count(),
            )
            .select_from(
                FinancialReportVersion,
            )
            .where(
                FinancialReportVersion
                .financial_report_id
                == report_id,
            ),
        )
        or 0
    )

    assert version_count == 0