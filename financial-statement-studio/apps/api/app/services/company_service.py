from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.repositories.company_repository import CompanyRepository
from app.schemas.company import CompanyCreate, CompanyUpdate


class CompanyServiceError(Exception):
    """Base exception for company operations."""


class CompanyNotFoundError(CompanyServiceError):
    """Raised when a company cannot be found."""


class EmptyCompanyUpdateError(CompanyServiceError):
    """Raised when an update request contains no fields."""


class CompanyPersistenceError(CompanyServiceError):
    """Raised when a company database operation fails."""


class CompanyService:
    """Application logic for company management."""

    def __init__(
        self,
        repository: CompanyRepository | None = None,
    ) -> None:
        self.repository = (
            repository
            or CompanyRepository()
        )

    def create_company(
        self,
        database_session: Session,
        payload: CompanyCreate,
    ) -> Company:
        values = payload.model_dump(
            mode="json",
        )

        try:
            return self.repository.create(
                database_session,
                values,
            )
        except SQLAlchemyError as error:
            raise CompanyPersistenceError(
                "The company could not be saved.",
            ) from error

    def list_companies(
        self,
        database_session: Session,
        *,
        search: str | None,
        include_inactive: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[Company], int]:
        normalized_search = (
            search.strip()
            if search and search.strip()
            else None
        )

        try:
            return self.repository.list(
                database_session,
                search=normalized_search,
                include_inactive=include_inactive,
                offset=offset,
                limit=limit,
            )
        except SQLAlchemyError as error:
            raise CompanyPersistenceError(
                "Companies could not be retrieved.",
            ) from error

    def get_company(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company:
        try:
            company = self.repository.get_by_id(
                database_session,
                company_id,
            )
        except SQLAlchemyError as error:
            raise CompanyPersistenceError(
                "The company could not be retrieved.",
            ) from error

        if company is None:
            raise CompanyNotFoundError(
                "The requested company was not found.",
            )

        return company

    def update_company(
        self,
        database_session: Session,
        company_id: str,
        payload: CompanyUpdate,
    ) -> Company:
        company = self.get_company(
            database_session,
            company_id,
        )

        changes = payload.model_dump(
            mode="json",
            exclude_unset=True,
        )

        if not changes:
            raise EmptyCompanyUpdateError(
                "Provide at least one company field to update.",
            )

        try:
            return self.repository.update(
                database_session,
                company,
                changes,
            )
        except SQLAlchemyError as error:
            raise CompanyPersistenceError(
                "The company could not be updated.",
            ) from error

    def deactivate_company(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company:
        company = self.get_company(
            database_session,
            company_id,
        )

        if not company.is_active:
            return company

        try:
            return self.repository.deactivate(
                database_session,
                company,
            )
        except SQLAlchemyError as error:
            raise CompanyPersistenceError(
                "The company could not be deactivated.",
            ) from error