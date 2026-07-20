from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.ledger_account import LedgerAccount


class LedgerAccountRepository:
    """Database operations for a company's Chart of Accounts."""

    def get_company_by_id(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company | None:
        return database_session.get(
            Company,
            company_id,
        )

    def get_by_id(
        self,
        database_session: Session,
        account_id: str,
    ) -> LedgerAccount | None:
        return database_session.get(
            LedgerAccount,
            account_id,
        )

    def get_existing_codes(
        self,
        database_session: Session,
        company_id: str,
    ) -> set[str]:
        statement = select(
            LedgerAccount.account_code,
        ).where(
            LedgerAccount.company_id
            == company_id,
        )

        return set(
            database_session.scalars(
                statement,
            ).all(),
        )

    def create_many(
        self,
        database_session: Session,
        accounts: Sequence[LedgerAccount],
    ) -> list[LedgerAccount]:
        try:
            database_session.add_all(
                accounts,
            )
            database_session.commit()

            for account in accounts:
                database_session.refresh(
                    account,
                )
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return list(accounts)

    def create(
        self,
        database_session: Session,
        account: LedgerAccount,
    ) -> LedgerAccount:
        try:
            database_session.add(account)
            database_session.commit()
            database_session.refresh(account)
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return account

    def list(
        self,
        database_session: Session,
        *,
        company_id: str,
        search: str | None,
        account_type: str | None,
        report_category: str | None,
        include_inactive: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[LedgerAccount], int]:
        filters = [
            LedgerAccount.company_id
            == company_id,
        ]

        if not include_inactive:
            filters.append(
                LedgerAccount.is_active.is_(
                    True,
                ),
            )

        if search:
            normalized_search = (
                search.strip().lower()
            )

            filters.append(
                (
                    func.lower(
                        LedgerAccount.account_name,
                    ).contains(
                        normalized_search,
                    )
                )
                | (
                    func.lower(
                        LedgerAccount.account_code,
                    ).contains(
                        normalized_search,
                    )
                ),
            )

        if account_type:
            filters.append(
                LedgerAccount.account_type
                == account_type,
            )

        if report_category:
            filters.append(
                LedgerAccount.report_category
                == report_category,
            )

        list_statement = (
            select(LedgerAccount)
            .where(*filters)
            .order_by(
                LedgerAccount.display_order.asc(),
                LedgerAccount.account_code.asc(),
            )
            .offset(offset)
            .limit(limit)
        )

        count_statement = (
            select(func.count())
            .select_from(LedgerAccount)
            .where(*filters)
        )

        items = list(
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

        return items, total

    def update(
        self,
        database_session: Session,
        account: LedgerAccount,
        values: dict[str, object],
    ) -> LedgerAccount:
        for field_name, value in values.items():
            setattr(
                account,
                field_name,
                value,
            )

        try:
            database_session.add(account)
            database_session.commit()
            database_session.refresh(account)
        except SQLAlchemyError:
            database_session.rollback()
            raise

        return account