from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.ledger_account import (
    LedgerAccount,
)
from app.schemas.cash_flow import (
    CashFlowReadinessAccount,
    CashFlowReadinessResponse,
    CashFlowReadinessWarning,
)
from app.services.journal_entry_service import (
    JournalEntryPersistenceError,
    JournalEntryService,
    utc_now,
)


class CashFlowReadinessService:
    """
    Checks whether a report's Chart of Accounts is ready
    for Statement of Cash Flows calculations.
    """

    def __init__(
        self,
        journal_entry_service: JournalEntryService
        | None = None,
    ) -> None:
        self.journal_entry_service = (
            journal_entry_service
            or JournalEntryService()
        )

    def get_company_accounts(
        self,
        database_session: Session,
        company_id: str,
    ) -> list[LedgerAccount]:
        statement = (
            select(LedgerAccount)
            .where(
                LedgerAccount.company_id
                == company_id,
            )
            .order_by(
                LedgerAccount.display_order.asc(),
                LedgerAccount.account_code.asc(),
            )
        )

        try:
            return list(
                database_session.scalars(
                    statement,
                ).all(),
            )
        except SQLAlchemyError as error:
            raise JournalEntryPersistenceError(
                "Ledger accounts could not be checked for cash-flow readiness.",
            ) from error

    def create_account_response(
        self,
        account: LedgerAccount,
    ) -> CashFlowReadinessAccount:
        return CashFlowReadinessAccount(
            id=account.id,
            account_code=account.account_code,
            account_name=account.account_name,
            report_category=(
                account.report_category
            ),
            cash_flow_category=(
                account.cash_flow_category
            ),
            is_cash_equivalent=(
                account.is_cash_equivalent
            ),
            is_active=account.is_active,
        )

    def calculate_readiness(
        self,
        database_session: Session,
        report_id: str,
    ) -> CashFlowReadinessResponse:
        financial_report = (
            self.journal_entry_service.get_report(
                database_session,
                report_id,
            )
        )

        accounts = self.get_company_accounts(
            database_session,
            financial_report.company_id,
        )

        active_cash_accounts = [
            account
            for account in accounts
            if (
                account.is_active
                and account.is_cash_equivalent
            )
        ]

        warnings: list[
            CashFlowReadinessWarning
        ] = []

        if not active_cash_accounts:
            warnings.append(
                CashFlowReadinessWarning(
                    code=(
                        "NO_ACTIVE_CASH_ACCOUNT"
                    ),
                    message=(
                        "Mark at least one active ledger account "
                        "as cash or cash equivalent."
                    ),
                ),
            )

        for account in accounts:
            if (
                account.is_cash_equivalent
                and not account.is_active
            ):
                warnings.append(
                    CashFlowReadinessWarning(
                        code=(
                            "INACTIVE_CASH_ACCOUNT"
                        ),
                        ledger_account_id=(
                            account.id
                        ),
                        message=(
                            f"{account.account_code} — "
                            f"{account.account_name} is marked as "
                            "cash equivalent but is inactive."
                        ),
                    ),
                )

            if (
                account.is_cash_equivalent
                and account.report_category
                != "current_assets"
            ):
                warnings.append(
                    CashFlowReadinessWarning(
                        code=(
                            "CASH_ACCOUNT_NOT_CURRENT_ASSET"
                        ),
                        ledger_account_id=(
                            account.id
                        ),
                        message=(
                            f"{account.account_code} — "
                            f"{account.account_name} is marked as "
                            "cash equivalent but is not classified "
                            "under current assets."
                        ),
                    ),
                )

            if (
                account.is_active
                and not account.is_cash_equivalent
                and account.cash_flow_category
                is None
            ):
                warnings.append(
                    CashFlowReadinessWarning(
                        code=(
                            "MISSING_CASH_FLOW_CATEGORY"
                        ),
                        ledger_account_id=(
                            account.id
                        ),
                        message=(
                            f"{account.account_code} — "
                            f"{account.account_name} does not have "
                            "a cash-flow category."
                        ),
                    ),
                )

            if (
                account.is_active
                and account.report_category
                == "non_current_assets"
                and account.cash_flow_category
                not in {
                    "investing",
                    "non_cash",
                }
            ):
                warnings.append(
                    CashFlowReadinessWarning(
                        code=(
                            "NON_CURRENT_ASSET_CLASSIFICATION"
                        ),
                        ledger_account_id=(
                            account.id
                        ),
                        message=(
                            f"{account.account_code} — "
                            f"{account.account_name} should normally "
                            "use investing or non-cash classification."
                        ),
                    ),
                )

            if (
                account.is_active
                and account.report_category
                in {
                    "non_current_liabilities",
                    "equity",
                }
                and account.cash_flow_category
                not in {
                    "financing",
                    "non_cash",
                }
            ):
                warnings.append(
                    CashFlowReadinessWarning(
                        code=(
                            "FINANCING_ACCOUNT_CLASSIFICATION"
                        ),
                        ledger_account_id=(
                            account.id
                        ),
                        message=(
                            f"{account.account_code} — "
                            f"{account.account_name} should normally "
                            "use financing or non-cash classification."
                        ),
                    ),
                )

        blocking_warning_codes = {
            "NO_ACTIVE_CASH_ACCOUNT",
            "CASH_ACCOUNT_NOT_CURRENT_ASSET",
            "MISSING_CASH_FLOW_CATEGORY",
        }

        is_ready = (
            len(active_cash_accounts) > 0
            and not any(
                warning.code
                in blocking_warning_codes
                for warning in warnings
            )
        )

        return CashFlowReadinessResponse(
            financial_report_id=(
                financial_report.id
            ),
            company_id=(
                financial_report.company_id
            ),
            is_ready=is_ready,
            active_cash_account_count=(
                len(active_cash_accounts)
            ),
            active_cash_accounts=[
                self.create_account_response(
                    account,
                )
                for account in active_cash_accounts
            ],
            warnings=warnings,
            generated_at=utc_now(),
        )