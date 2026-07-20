from datetime import date

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.financial_report import FinancialReport
from app.repositories.financial_report_repository import (
    FinancialReportRepository,
)
from app.schemas.company import BusinessType
from app.schemas.financial_report import (
    FinancialReportCreate,
    FinancialReportUpdate,
    ReportStatus,
    ReportType,
)


class FinancialReportServiceError(Exception):
    """Base exception for financial-report operations."""


class FinancialReportNotFoundError(
    FinancialReportServiceError,
):
    """Raised when a financial report cannot be found."""


class FinancialReportCompanyNotFoundError(
    FinancialReportServiceError,
):
    """Raised when the selected company cannot be found."""


class InactiveFinancialReportCompanyError(
    FinancialReportServiceError,
):
    """Raised when a new report is created for an inactive company."""


class InvalidFinancialReportPeriodError(
    FinancialReportServiceError,
):
    """Raised when the reporting period is invalid."""


class InvalidComparisonReportError(
    FinancialReportServiceError,
):
    """Raised when a comparative report is invalid."""


class EmptyFinancialReportUpdateError(
    FinancialReportServiceError,
):
    """Raised when an update contains no supplied fields."""


class FinancialReportPersistenceError(
    FinancialReportServiceError,
):
    """Raised when a report database operation fails."""


def format_report_date(
    value: date,
) -> str:
    """Create a readable date for automatically generated titles."""

    return (
        f"{value.day} "
        f"{value.strftime('%B %Y')}"
    )


def build_report_title(
    report_type: ReportType,
    period_end: date,
) -> str:
    """Generate a professional report title."""

    formatted_date = format_report_date(
        period_end,
    )

    titles = {
        ReportType.ANNUAL_FINANCIAL_STATEMENTS: (
            "Financial Statements for the Year "
            f"Ended {formatted_date}"
        ),
        ReportType.MANAGEMENT_ACCOUNTS: (
            "Management Accounts for the Period "
            f"Ended {formatted_date}"
        ),
        ReportType.TAX_COMPUTATION: (
            "Tax Computation for the Year "
            f"Ended {formatted_date}"
        ),
        ReportType.CUSTOM_REPORT: (
            "Financial Report for the Period "
            f"Ended {formatted_date}"
        ),
    }

    return titles[report_type]


def get_default_business_template(
    company: Company,
) -> BusinessType:
    """Use the company's business type as the report template."""

    try:
        return BusinessType(
            company.business_type,
        )
    except ValueError:
        return BusinessType.OTHER


class FinancialReportService:
    """Application rules for financial-report documents."""

    def __init__(
        self,
        repository: FinancialReportRepository | None = None,
    ) -> None:
        self.repository = (
            repository
            or FinancialReportRepository()
        )

    def get_company(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company:
        try:
            company = (
                self.repository.get_company_by_id(
                    database_session,
                    company_id,
                )
            )
        except SQLAlchemyError as error:
            raise FinancialReportPersistenceError(
                "The selected company could not be retrieved.",
            ) from error

        if company is None:
            raise FinancialReportCompanyNotFoundError(
                "The selected company was not found.",
            )

        return company

    def get_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport:
        try:
            financial_report = (
                self.repository.get_by_id(
                    database_session,
                    report_id,
                )
            )
        except SQLAlchemyError as error:
            raise FinancialReportPersistenceError(
                "The financial report could not be retrieved.",
            ) from error

        if financial_report is None:
            raise FinancialReportNotFoundError(
                "The requested financial report was not found.",
            )

        return financial_report

    def validate_period(
        self,
        period_start: date,
        period_end: date,
    ) -> None:
        if period_end < period_start:
            raise InvalidFinancialReportPeriodError(
                "Reporting end date cannot be before the start date.",
            )

    def validate_comparison_report(
        self,
        database_session: Session,
        *,
        company_id: str,
        comparison_report_id: str | None,
        current_period_end: date,
        current_report_id: str | None = None,
    ) -> FinancialReport | None:
        if comparison_report_id is None:
            return None

        if (
            current_report_id
            and comparison_report_id
            == current_report_id
        ):
            raise InvalidComparisonReportError(
                "A financial report cannot compare against itself.",
            )

        comparison_report = self.get_report(
            database_session,
            comparison_report_id,
        )

        if (
            comparison_report.company_id
            != company_id
        ):
            raise InvalidComparisonReportError(
                "The comparative report must belong to the same company.",
            )

        if (
            comparison_report.period_end
            >= current_period_end
        ):
            raise InvalidComparisonReportError(
                "The comparative report must be from an earlier reporting period.",
            )

        return comparison_report

    def create_report(
        self,
        database_session: Session,
        payload: FinancialReportCreate,
    ) -> FinancialReport:
        company = self.get_company(
            database_session,
            payload.company_id,
        )

        if not company.is_active:
            raise InactiveFinancialReportCompanyError(
                "A new report cannot be created for an inactive company.",
            )

        self.validate_period(
            payload.period_start,
            payload.period_end,
        )

        self.validate_comparison_report(
            database_session,
            company_id=company.id,
            comparison_report_id=(
                payload.comparison_report_id
            ),
            current_period_end=payload.period_end,
        )

        report_type = payload.report_type

        title = (
            payload.title
            or build_report_title(
                report_type,
                payload.period_end,
            )
        )

        business_template = (
            payload.business_template
            or get_default_business_template(
                company,
            )
        )

        currency = (
            payload.currency
            or company.default_currency
        )

        values: dict[str, object] = {
            "company_id": company.id,
            "comparison_report_id": (
                payload.comparison_report_id
            ),
            "title": title,
            "report_type": report_type.value,
            "period_start": payload.period_start,
            "period_end": payload.period_end,
            "financial_year": (
                payload.period_end.year
            ),
            "currency": currency,
            "business_template": (
                business_template.value
            ),
            "status": ReportStatus.DRAFT.value,
            "accountant_report_text": (
                payload.accountant_report_text
            ),
        }

        try:
            return self.repository.create(
                database_session,
                values,
            )
        except SQLAlchemyError as error:
            raise FinancialReportPersistenceError(
                "The financial report could not be saved.",
            ) from error

    def list_reports(
        self,
        database_session: Session,
        *,
        company_id: str | None,
        search: str | None,
        report_status: ReportStatus | None,
        include_archived: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[FinancialReport], int]:
        if company_id:
            self.get_company(
                database_session,
                company_id,
            )

        normalized_search = (
            search.strip()
            if search and search.strip()
            else None
        )

        try:
            return self.repository.list(
                database_session,
                company_id=company_id,
                search=normalized_search,
                report_status=(
                    report_status.value
                    if report_status
                    else None
                ),
                include_archived=include_archived,
                offset=offset,
                limit=limit,
            )
        except SQLAlchemyError as error:
            raise FinancialReportPersistenceError(
                "Financial reports could not be retrieved.",
            ) from error

    def update_report(
        self,
        database_session: Session,
        report_id: str,
        payload: FinancialReportUpdate,
    ) -> FinancialReport:
        financial_report = self.get_report(
            database_session,
            report_id,
        )

        supplied_fields = payload.model_fields_set

        if not supplied_fields:
            raise EmptyFinancialReportUpdateError(
                "Provide at least one report field to update.",
            )

        company = self.get_company(
            database_session,
            financial_report.company_id,
        )

        period_start = (
            payload.period_start
            if "period_start" in supplied_fields
            else financial_report.period_start
        )

        period_end = (
            payload.period_end
            if "period_end" in supplied_fields
            else financial_report.period_end
        )

        if period_start is None or period_end is None:
            raise InvalidFinancialReportPeriodError(
                "Both reporting start and end dates are required.",
            )

        self.validate_period(
            period_start,
            period_end,
        )

        comparison_report_id = (
            payload.comparison_report_id
            if "comparison_report_id"
            in supplied_fields
            else financial_report.comparison_report_id
        )

        self.validate_comparison_report(
            database_session,
            company_id=financial_report.company_id,
            comparison_report_id=(
                comparison_report_id
            ),
            current_period_end=period_end,
            current_report_id=financial_report.id,
        )

        report_type = (
            payload.report_type
            if "report_type" in supplied_fields
            and payload.report_type is not None
            else ReportType(
                financial_report.report_type,
            )
        )

        values: dict[str, object] = {}

        if "title" in supplied_fields:
            values["title"] = (
                payload.title
                or build_report_title(
                    report_type,
                    period_end,
                )
            )

        if "report_type" in supplied_fields:
            values["report_type"] = (
                report_type.value
            )

        if "period_start" in supplied_fields:
            values["period_start"] = (
                period_start
            )

        if "period_end" in supplied_fields:
            values["period_end"] = period_end
            values["financial_year"] = (
                period_end.year
            )

        if "currency" in supplied_fields:
            values["currency"] = (
                payload.currency
                or company.default_currency
            )

        if (
            "business_template"
            in supplied_fields
        ):
            template = (
                payload.business_template
                or get_default_business_template(
                    company,
                )
            )

            values["business_template"] = (
                template.value
            )

        if (
            "comparison_report_id"
            in supplied_fields
        ):
            values["comparison_report_id"] = (
                payload.comparison_report_id
            )

        if (
            "accountant_report_text"
            in supplied_fields
        ):
            values["accountant_report_text"] = (
                payload.accountant_report_text
            )

        try:
            return self.repository.update(
                database_session,
                financial_report,
                values,
            )
        except SQLAlchemyError as error:
            raise FinancialReportPersistenceError(
                "The financial report could not be updated.",
            ) from error