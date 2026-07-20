from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company


class CompanyRepository:
    """Database operations for company records."""

    def create(
        self,
        database_session: Session,
        values: dict[str, object],
    ) -> Company:
        company = Company(**values)

        try:
            database_session.add(company)
            database_session.commit()
            database_session.refresh(company)
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return company

    def get_by_id(
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
        search: str | None,
        include_inactive: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[Company], int]:
        filters = []

        if not include_inactive:
            filters.append(
                Company.is_active.is_(True),
            )

        if search:
            normalized_search = search.strip().lower()

            filters.append(
                func.lower(Company.name).contains(
                    normalized_search,
                ),
            )

        list_statement = (
            select(Company)
            .where(*filters)
            .order_by(
                Company.name.asc(),
                Company.created_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        count_statement = (
            select(func.count())
            .select_from(Company)
            .where(*filters)
        )

        companies = list(
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

        return companies, total

    def update(
        self,
        database_session: Session,
        company: Company,
        values: dict[str, object],
    ) -> Company:
        for field_name, value in values.items():
            setattr(
                company,
                field_name,
                value,
            )

        try:
            database_session.add(company)
            database_session.commit()
            database_session.refresh(company)
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return company

    def deactivate(
        self,
        database_session: Session,
        company: Company,
    ) -> Company:
        company.is_active = False

        try:
            database_session.add(company)
            database_session.commit()
            database_session.refresh(company)
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return company