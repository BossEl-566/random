from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.ledger_account import LedgerAccount
from app.repositories.ledger_account_repository import (
    LedgerAccountRepository,
)
from app.schemas.company import BusinessType
from app.schemas.ledger_account import (
    AccountType,
    LedgerAccountCreate,
    LedgerAccountUpdate,
    ReportCategory,
)
from app.services.accounting.account_templates import (
    get_account_template,
)


class LedgerAccountServiceError(Exception):
    """Base exception for Chart of Accounts operations."""


class LedgerAccountNotFoundError(
    LedgerAccountServiceError,
):
    """Raised when an account cannot be found."""


class LedgerAccountCompanyNotFoundError(
    LedgerAccountServiceError,
):
    """Raised when the selected company cannot be found."""


class InactiveLedgerAccountCompanyError(
    LedgerAccountServiceError,
):
    """Raised when an inactive company is modified."""


class DuplicateAccountCodeError(
    LedgerAccountServiceError,
):
    """Raised when a company already uses an account code."""


class InvalidAccountClassificationError(
    LedgerAccountServiceError,
):
    """Raised when account type and report category conflict."""


class InvalidParentAccountError(
    LedgerAccountServiceError,
):
    """Raised when an invalid parent account is selected."""


class ProtectedSystemAccountError(
    LedgerAccountServiceError,
):
    """Raised when protected fields of a system account are changed."""


class EmptyLedgerAccountUpdateError(
    LedgerAccountServiceError,
):
    """Raised when no fields are supplied for an update."""


class LedgerAccountPersistenceError(
    LedgerAccountServiceError,
):
    """Raised when the database operation fails."""


CATEGORY_ACCOUNT_TYPES: dict[
    ReportCategory,
    AccountType,
] = {
    ReportCategory.REVENUE: AccountType.REVENUE,
    ReportCategory.OTHER_INCOME: AccountType.REVENUE,

    ReportCategory.COST_OF_SALES: AccountType.EXPENSE,
    ReportCategory.DIRECT_SERVICE_COSTS: AccountType.EXPENSE,
    ReportCategory.MANUFACTURING_COSTS: AccountType.EXPENSE,
    ReportCategory.ADMINISTRATIVE_EXPENSES: AccountType.EXPENSE,
    ReportCategory.SELLING_DISTRIBUTION_EXPENSES: AccountType.EXPENSE,
    ReportCategory.FINANCE_COSTS: AccountType.EXPENSE,
    ReportCategory.TAXATION: AccountType.EXPENSE,

    ReportCategory.CURRENT_ASSETS: AccountType.ASSET,
    ReportCategory.NON_CURRENT_ASSETS: AccountType.ASSET,

    ReportCategory.CURRENT_LIABILITIES: AccountType.LIABILITY,
    ReportCategory.NON_CURRENT_LIABILITIES: AccountType.LIABILITY,

    ReportCategory.EQUITY: AccountType.EQUITY,
}


PROTECTED_SYSTEM_FIELDS = {
    "account_code",
    "account_type",
    "report_category",
    "normal_balance",
}


class LedgerAccountService:
    """Application rules for the Chart of Accounts."""

    def __init__(
        self,
        repository: LedgerAccountRepository | None = None,
    ) -> None:
        self.repository = (
            repository
            or LedgerAccountRepository()
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
            raise LedgerAccountPersistenceError(
                "The company could not be retrieved.",
            ) from error

        if company is None:
            raise LedgerAccountCompanyNotFoundError(
                "The selected company was not found.",
            )

        return company

    def get_account(
        self,
        database_session: Session,
        account_id: str,
    ) -> LedgerAccount:
        try:
            account = self.repository.get_by_id(
                database_session,
                account_id,
            )
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "The ledger account could not be retrieved.",
            ) from error

        if account is None:
            raise LedgerAccountNotFoundError(
                "The requested ledger account was not found.",
            )

        return account

    def validate_classification(
        self,
        account_type: AccountType,
        report_category: ReportCategory,
    ) -> None:
        required_account_type = (
            CATEGORY_ACCOUNT_TYPES[
                report_category
            ]
        )

        if account_type != required_account_type:
            raise InvalidAccountClassificationError(
                (
                    f"The report category '{report_category.value}' "
                    f"requires account type "
                    f"'{required_account_type.value}'."
                ),
            )

    def validate_parent_account(
        self,
        database_session: Session,
        *,
        company_id: str,
        parent_account_id: str | None,
        current_account_id: str | None = None,
    ) -> LedgerAccount | None:
        if parent_account_id is None:
            return None

        if (
            current_account_id
            and parent_account_id
            == current_account_id
        ):
            raise InvalidParentAccountError(
                "An account cannot be its own parent.",
            )

        parent_account = self.get_account(
            database_session,
            parent_account_id,
        )

        if parent_account.company_id != company_id:
            raise InvalidParentAccountError(
                "The parent account must belong to the same company.",
            )

        visited_account_ids = {
            current_account_id,
        }

        current_parent = parent_account

        while current_parent is not None:
            if (
                current_parent.id
                in visited_account_ids
            ):
                raise InvalidParentAccountError(
                    "The selected parent account would create a circular hierarchy.",
                )

            visited_account_ids.add(
                current_parent.id,
            )

            if (
                current_parent.parent_account_id
                is None
            ):
                break

            current_parent = self.get_account(
                database_session,
                current_parent.parent_account_id,
            )

        return parent_account

    def initialize_chart(
        self,
        database_session: Session,
        company_id: str,
    ) -> tuple[
        Company,
        list[LedgerAccount],
        int,
    ]:
        company = self.get_company(
            database_session,
            company_id,
        )

        if not company.is_active:
            raise InactiveLedgerAccountCompanyError(
                "The Chart of Accounts cannot be initialized for an inactive company.",
            )

        try:
            business_type = BusinessType(
                company.business_type,
            )
        except ValueError:
            business_type = BusinessType.OTHER

        template = get_account_template(
            business_type,
        )

        try:
            existing_codes = (
                self.repository.get_existing_codes(
                    database_session,
                    company.id,
                )
            )
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "Existing ledger accounts could not be checked.",
            ) from error

        new_accounts = [
            LedgerAccount(
                company_id=company.id,
                account_code=item.account_code,
                account_name=item.account_name,
                account_type=item.account_type.value,
                report_category=item.report_category.value,
                cash_flow_category=(
                    item.cash_flow_category.value
                    if item.cash_flow_category
                    else None
                ),
                normal_balance=(
                    item.normal_balance.value
                ),
                description=item.description,
                display_order=item.display_order,
                is_system_account=True,
                is_active=True,
            )
            for item in template
            if item.account_code
            not in existing_codes
        ]

        skipped_count = (
            len(template)
            - len(new_accounts)
        )

        if not new_accounts:
            return (
                company,
                [],
                skipped_count,
            )

        try:
            created_accounts = (
                self.repository.create_many(
                    database_session,
                    new_accounts,
                )
            )
        except IntegrityError as error:
            raise DuplicateAccountCodeError(
                "One or more account codes already exist for this company.",
            ) from error
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "The Chart of Accounts could not be initialized.",
            ) from error

        return (
            company,
            created_accounts,
            skipped_count,
        )

    def list_accounts(
        self,
        database_session: Session,
        *,
        company_id: str,
        search: str | None,
        account_type: AccountType | None,
        report_category: ReportCategory | None,
        include_inactive: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[LedgerAccount], int]:
        self.get_company(
            database_session,
            company_id,
        )

        try:
            return self.repository.list(
                database_session,
                company_id=company_id,
                search=search,
                account_type=(
                    account_type.value
                    if account_type
                    else None
                ),
                report_category=(
                    report_category.value
                    if report_category
                    else None
                ),
                include_inactive=include_inactive,
                offset=offset,
                limit=limit,
            )
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "Ledger accounts could not be retrieved.",
            ) from error

    def create_account(
        self,
        database_session: Session,
        company_id: str,
        payload: LedgerAccountCreate,
    ) -> LedgerAccount:
        company = self.get_company(
            database_session,
            company_id,
        )

        if not company.is_active:
            raise InactiveLedgerAccountCompanyError(
                "A ledger account cannot be created for an inactive company.",
            )

        self.validate_classification(
            payload.account_type,
            payload.report_category,
        )

        self.validate_parent_account(
            database_session,
            company_id=company.id,
            parent_account_id=(
                payload.parent_account_id
            ),
        )

        account = LedgerAccount(
            company_id=company.id,
            parent_account_id=(
                payload.parent_account_id
            ),
            account_code=payload.account_code,
            account_name=payload.account_name,
            account_type=(
                payload.account_type.value
            ),
            report_category=(
                payload.report_category.value
            ),
            cash_flow_category=(
                payload.cash_flow_category.value
                if payload.cash_flow_category
                else None
            ),
            normal_balance=(
                payload.normal_balance.value
            ),
            description=payload.description,
            display_order=payload.display_order,
            is_system_account=False,
            is_active=True,
        )

        try:
            return self.repository.create(
                database_session,
                account,
            )
        except IntegrityError as error:
            raise DuplicateAccountCodeError(
                (
                    f"Account code '{payload.account_code}' "
                    "already exists for this company."
                ),
            ) from error
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "The ledger account could not be saved.",
            ) from error

    def update_account(
        self,
        database_session: Session,
        account_id: str,
        payload: LedgerAccountUpdate,
    ) -> LedgerAccount:
        account = self.get_account(
            database_session,
            account_id,
        )

        changes = payload.model_dump(
            mode="json",
            exclude_unset=True,
        )

        if not changes:
            raise EmptyLedgerAccountUpdateError(
                "Provide at least one ledger account field to update.",
            )

        if account.is_system_account:
            protected_changes = (
                PROTECTED_SYSTEM_FIELDS
                & changes.keys()
            )

            if protected_changes:
                raise ProtectedSystemAccountError(
                    "System-account codes and classifications cannot be changed.",
                )

        account_type = AccountType(
            changes.get(
                "account_type",
                account.account_type,
            ),
        )

        report_category = ReportCategory(
            changes.get(
                "report_category",
                account.report_category,
            ),
        )

        self.validate_classification(
            account_type,
            report_category,
        )

        if "parent_account_id" in changes:
            self.validate_parent_account(
                database_session,
                company_id=account.company_id,
                parent_account_id=(
                    changes[
                        "parent_account_id"
                    ]
                ),
                current_account_id=account.id,
            )

        try:
            return self.repository.update(
                database_session,
                account,
                changes,
            )
        except IntegrityError as error:
            raise DuplicateAccountCodeError(
                "The selected account code already exists for this company.",
            ) from error
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "The ledger account could not be updated.",
            ) from error

    def deactivate_account(
        self,
        database_session: Session,
        account_id: str,
    ) -> LedgerAccount:
        account = self.get_account(
            database_session,
            account_id,
        )

        if not account.is_active:
            return account

        try:
            return self.repository.update(
                database_session,
                account,
                {
                    "is_active": False,
                },
            )
        except SQLAlchemyError as error:
            raise LedgerAccountPersistenceError(
                "The ledger account could not be deactivated.",
            ) from error