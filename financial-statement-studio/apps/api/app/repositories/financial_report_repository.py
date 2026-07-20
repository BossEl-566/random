from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.financial_report import FinancialReport


class FinancialReportRepository:
    """Database operations for financial reports."""

    def create(
        self,
        database_session: Session,
        values: dict[str, object],
    ) -> FinancialReport:
        financial_report = FinancialReport(
            **values,
        )

        try:
            database_session.add(
                financial_report,
            )
            database_session.commit()
            database_session.refresh(
                financial_report,
            )
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return financial_report

    def get_by_id(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport | None:
        return database_session.get(
            FinancialReport,
            report_id,
        )

    def get_company_by_id(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company | None:
        return database_session.get(
            Company,
            company_id,
        )

    def list(
        self,
        database_session: Session,
        *,
        company_id: str | None,
        search: str | None,
        report_status: str | None,
        include_archived: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[FinancialReport], int]:
        filters = []

        if company_id:
            filters.append(
                FinancialReport.company_id
                == company_id,
            )

        if search:
            normalized_search = (
                search.strip().lower()
            )

            filters.append(
                func.lower(
                    FinancialReport.title,
                ).contains(
                    normalized_search,
                ),
            )

        if report_status:
            filters.append(
                FinancialReport.status
                == report_status,
            )
        elif not include_archived:
            filters.append(
                FinancialReport.status
                != "archived",
            )

        list_statement = (
            select(FinancialReport)
            .where(*filters)
            .order_by(
                FinancialReport.period_end.desc(),
                FinancialReport.created_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        count_statement = (
            select(func.count())
            .select_from(FinancialReport)
            .where(*filters)
        )

        reports = list(
            database_session.scalars(
                list_statement,
            ).all(),
        )

        total = (
            database_session.scalar(
                count_statement,
            )
            or 0
        )

        return reports, total

    def update(
        self,
        database_session: Session,
        financial_report: FinancialReport,
        values: dict[str, object],
    ) -> FinancialReport:
        for field_name, value in values.items():
            setattr(
                financial_report,
                field_name,
                value,
            )

        try:
            database_session.add(
                financial_report,
            )
            database_session.commit()
            database_session.refresh(
                financial_report,
            )
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return financial_report