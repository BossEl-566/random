from datetime import date

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models import Company, FinancialReport


def enable_test_foreign_keys(
    dbapi_connection: object,
    connection_record: object,
) -> None:
    """Enable SQLite foreign keys in the isolated test database."""

    del connection_record

    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]

    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def test_company_can_have_financial_reports() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
    )

    event.listen(
        engine,
        "connect",
        enable_test_foreign_keys,
    )

    Base.metadata.create_all(engine)

    with Session(engine) as database_session:
        company = Company(
            name="Test Trading Company",
            business_type="trading",
            address="Accra, Ghana",
            default_currency="GHS",
        )

        report = FinancialReport(
            company=company,
            title=(
                "Financial Statements for the Year "
                "Ended 31 December 2025"
            ),
            report_type="annual_financial_statements",
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 31),
            financial_year=2025,
            currency="GHS",
            business_template="trading",
            status="draft",
        )

        database_session.add(report)
        database_session.commit()

        saved_company = database_session.scalar(
            select(Company).where(
                Company.name == "Test Trading Company",
            ),
        )

        assert saved_company is not None
        assert saved_company.default_currency == "GHS"
        assert len(saved_company.financial_reports) == 1

        saved_report = saved_company.financial_reports[0]

        assert saved_report.financial_year == 2025
        assert saved_report.status == "draft"
        assert saved_report.company_id == saved_company.id


def test_report_period_must_be_valid() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
    )

    event.listen(
        engine,
        "connect",
        enable_test_foreign_keys,
    )

    Base.metadata.create_all(engine)

    company = Company(
        name="Invalid Period Test Company",
    )

    invalid_report = FinancialReport(
        company=company,
        title="Invalid Financial Report",
        period_start=date(2025, 12, 31),
        period_end=date(2025, 1, 1),
        financial_year=2025,
    )

    with Session(engine) as database_session:
        database_session.add(invalid_report)

        try:
            database_session.commit()
        except Exception:
            database_session.rollback()
        else:
            raise AssertionError(
                "The database accepted an invalid reporting period.",
            )