from collections.abc import Generator
from datetime import date
from decimal import Decimal

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
from app.models.tax_calculation import (
    TaxCalculation,
)
from app.models.tax_profile import TaxProfile
from app.models.tax_rule import TaxRule


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


def create_company_and_report(
    database_session: Session,
) -> tuple[
    Company,
    FinancialReport,
]:
    company = Company(
        name="Tax Model Test Company",
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

    database_session.refresh(company)
    database_session.refresh(report)

    return company, report


def create_profile_and_rule(
    database_session: Session,
    company: Company,
) -> tuple[
    TaxProfile,
    TaxRule,
]:
    profile = TaxProfile(
        company_id=company.id,
        profile_code="GH-DOMESTIC",
        profile_name="Ghana Domestic Tax Profile",
        jurisdiction_country_code="GH",
        jurisdiction_name="Ghana",
        taxpayer_category="Standard",
        is_default=True,
        is_active=True,
    )

    database_session.add(profile)
    database_session.flush()

    rule = TaxRule(
        tax_profile_id=profile.id,
        rule_code="CIT-STANDARD",
        rule_name="Corporate Income Tax",
        tax_type="corporate_income_tax",
        calculation_method="percentage",
        rate_percentage=Decimal(
            "25.000000",
        ),
        fixed_amount=None,
        currency="GHS",
        effective_from=date(
            2025,
            1,
            1,
        ),
        effective_to=None,
        taxpayer_category="Standard",
        business_activity=None,
        status="active",
        is_system_rule=False,
        display_order=10,
    )

    database_session.add(rule)
    database_session.commit()

    database_session.refresh(profile)
    database_session.refresh(rule)

    return profile, rule


def test_tax_profile_rule_and_calculation_can_be_stored(
    database_session: Session,
) -> None:
    company, report = (
        create_company_and_report(
            database_session,
        )
    )

    profile, rule = (
        create_profile_and_rule(
            database_session,
            company,
        )
    )

    calculation = TaxCalculation(
        financial_report_id=report.id,
        tax_rule_id=rule.id,
        calculation_date=date(
            2025,
            12,
            31,
        ),
        tax_base=Decimal(
            "100000.00",
        ),
        tax_amount=Decimal(
            "25000.00",
        ),
        currency="GHS",
        rule_code_snapshot=(
            rule.rule_code
        ),
        rule_name_snapshot=(
            rule.rule_name
        ),
        tax_type_snapshot=(
            rule.tax_type
        ),
        calculation_method_snapshot=(
            rule.calculation_method
        ),
        rate_applied=(
            rule.rate_percentage
        ),
        fixed_amount_applied=None,
        calculation_details_json=(
            '{"source":"model-test"}'
        ),
        status="draft",
    )

    database_session.add(calculation)
    database_session.commit()
    database_session.refresh(calculation)

    assert profile.company_id == company.id
    assert rule.tax_profile_id == profile.id

    assert (
        calculation.financial_report_id
        == report.id
    )

    assert (
        calculation.tax_amount
        == Decimal("25000.00")
    )

    assert (
        calculation.rate_applied
        == Decimal("25.000000")
    )


def test_percentage_above_one_hundred_is_rejected(
    database_session: Session,
) -> None:
    company, _ = (
        create_company_and_report(
            database_session,
        )
    )

    profile = TaxProfile(
        company_id=company.id,
        profile_code="INVALID-RATE",
        profile_name="Invalid Rate Profile",
        jurisdiction_country_code="GH",
        jurisdiction_name="Ghana",
        is_default=False,
        is_active=True,
    )

    database_session.add(profile)
    database_session.flush()

    invalid_rule = TaxRule(
        tax_profile_id=profile.id,
        rule_code="INVALID-PERCENTAGE",
        rule_name="Invalid Percentage",
        tax_type="custom",
        calculation_method="percentage",
        rate_percentage=Decimal(
            "101.000000",
        ),
        fixed_amount=None,
        currency="GHS",
        effective_from=date(
            2025,
            1,
            1,
        ),
        status="draft",
        is_system_rule=False,
        display_order=0,
    )

    database_session.add(invalid_rule)

    with pytest.raises(
        IntegrityError,
    ):
        database_session.commit()

    database_session.rollback()


def test_invalid_effective_date_range_is_rejected(
    database_session: Session,
) -> None:
    company, _ = (
        create_company_and_report(
            database_session,
        )
    )

    profile = TaxProfile(
        company_id=company.id,
        profile_code="INVALID-DATES",
        profile_name="Invalid Date Profile",
        jurisdiction_country_code="GH",
        jurisdiction_name="Ghana",
        is_default=False,
        is_active=True,
    )

    database_session.add(profile)
    database_session.flush()

    invalid_rule = TaxRule(
        tax_profile_id=profile.id,
        rule_code="INVALID-DATE-RANGE",
        rule_name="Invalid Date Range",
        tax_type="custom",
        calculation_method="fixed_amount",
        rate_percentage=None,
        fixed_amount=Decimal(
            "500.00",
        ),
        currency="GHS",
        effective_from=date(
            2025,
            12,
            31,
        ),
        effective_to=date(
            2025,
            1,
            1,
        ),
        status="draft",
        is_system_rule=False,
        display_order=0,
    )

    database_session.add(invalid_rule)

    with pytest.raises(
        IntegrityError,
    ):
        database_session.commit()

    database_session.rollback()


def test_report_deletion_cascades_to_tax_calculations(
    database_session: Session,
) -> None:
    company, report = (
        create_company_and_report(
            database_session,
        )
    )

    _, rule = (
        create_profile_and_rule(
            database_session,
            company,
        )
    )

    calculation = TaxCalculation(
        financial_report_id=report.id,
        tax_rule_id=rule.id,
        calculation_date=date(
            2025,
            12,
            31,
        ),
        tax_base=Decimal(
            "20000.00",
        ),
        tax_amount=Decimal(
            "5000.00",
        ),
        currency="GHS",
        rule_code_snapshot=(
            rule.rule_code
        ),
        rule_name_snapshot=(
            rule.rule_name
        ),
        tax_type_snapshot=(
            rule.tax_type
        ),
        calculation_method_snapshot=(
            rule.calculation_method
        ),
        rate_applied=(
            rule.rate_percentage
        ),
        fixed_amount_applied=None,
        calculation_details_json=None,
        status="draft",
    )

    database_session.add(calculation)
    database_session.commit()

    report_id = report.id

    database_session.delete(report)
    database_session.commit()

    calculation_count = (
        database_session.scalar(
            select(
                func.count(),
            )
            .select_from(
                TaxCalculation,
            )
            .where(
                TaxCalculation
                .financial_report_id
                == report_id,
            ),
        )
        or 0
    )

    assert calculation_count == 0