import json
from datetime import (
    date,
    datetime,
)
from decimal import Decimal
from hashlib import sha256
from typing import Any

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)
from sqlalchemy.orm import Session

from app.models.financial_report import (
    FinancialReport,
)
from app.models.financial_report_note import (
    FinancialReportNote,
)
from app.models.financial_report_version import (
    FinancialReportVersion,
)
from app.models.journal_entry import (
    JournalEntry,
)
from app.models.journal_line import (
    JournalLine,
)
from app.models.mixins import utc_now
from app.repositories.report_finalisation_repository import (
    ReportFinalisationRepository,
)
from app.schemas.report_finalisation import (
    CreateFinancialReportRevisionRequest,
    FinalisationCheck,
    FinaliseFinancialReportRequest,
    FinaliseFinancialReportResponse,
    FinancialReportVersionListResponse,
    FinancialReportVersionResponse,
    FinancialReportVersionSummary,
    ReportFinalisationReadinessResponse,
)
from app.services.journal_entry_service import (
    JournalEntryService,
)
from app.services.tax_configuration_service import (
    TaxConfigurationService,
    TaxConfigurationServiceError,
)
from app.models.tax_calculation import (
    TaxCalculation,
)


LOCKED_REPORT_STATUSES = {
    "finalised",
    "printed",
    "archived",
}


class ReportFinalisationServiceError(
    Exception,
):
    """Base error for report finalisation."""


class ReportFinalisationNotFoundError(
    ReportFinalisationServiceError,
):
    """A report or version was not found."""


class ReportFinalisationValidationError(
    ReportFinalisationServiceError,
):
    """The report is not ready for finalisation."""


class ReportFinalisationConflictError(
    ReportFinalisationServiceError,
):
    """The finalisation conflicts with existing state."""


class ReportFinalisationPersistenceError(
    ReportFinalisationServiceError,
):
    """The finalisation could not be saved."""


def serialise_snapshot_value(
    value: Any,
) -> Any:
    if isinstance(
        value,
        (
            date,
            datetime,
        ),
    ):
        return value.isoformat()

    if isinstance(
        value,
        Decimal,
    ):
        return format(
            value,
            "f",
        )

    return value


class ReportFinalisationService:
    def __init__(
        self,
        repository:
            ReportFinalisationRepository
            | None = None,
        journal_entry_service:
            JournalEntryService
            | None = None,
        tax_configuration_service:
            TaxConfigurationService
            | None = None,
    ) -> None:
        self.repository = (
            repository
            or ReportFinalisationRepository()
        )

        self.journal_entry_service = (
            journal_entry_service
            or JournalEntryService()
        )

        self.tax_configuration_service = (
            tax_configuration_service
            or TaxConfigurationService()
        )

    def require_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport:
        try:
            report = self.repository.get_report(
                database_session,
                report_id,
            )
        except SQLAlchemyError as error:
            raise ReportFinalisationPersistenceError(
                "The financial report could not be retrieved.",
            ) from error

        if report is None:
            raise ReportFinalisationNotFoundError(
                "The financial report was not found.",
            )

        return report

    def require_version(
        self,
        database_session: Session,
        version_id: str,
    ) -> FinancialReportVersion:
        try:
            version = self.repository.get_version(
                database_session,
                version_id,
            )
        except SQLAlchemyError as error:
            raise ReportFinalisationPersistenceError(
                "The report version could not be retrieved.",
            ) from error

        if version is None:
            raise ReportFinalisationNotFoundError(
                "The report version was not found.",
            )

        return version

    def clean_required_text(
        self,
        value: str,
        field_name: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ReportFinalisationValidationError(
                f"{field_name} is required.",
            )

        return cleaned

    def clean_optional_text(
        self,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None

    def version_summary(
        self,
        version: FinancialReportVersion,
    ) -> FinancialReportVersionSummary:
        return (
            FinancialReportVersionSummary
            .model_validate(
                version,
            )
        )

    def check_readiness(
        self,
        database_session: Session,
        report_id: str,
    ) -> ReportFinalisationReadinessResponse:
        report = self.require_report(
            database_session,
            report_id,
        )

        blockers: list[
            FinalisationCheck
        ] = []

        warnings: list[
            FinalisationCheck
        ] = []

        if (
            report.status
            in LOCKED_REPORT_STATUSES
        ):
            blockers.append(
                FinalisationCheck(
                    code="report_locked",
                    title=(
                        "Report is already locked"
                    ),
                    detail=(
                        "A finalised, printed or archived "
                        "report cannot be finalised again."
                    ),
                ),
            )

        try:
            draft_entry_count = (
                self.repository
                .count_entries_by_status(
                    database_session,
                    report_id=report.id,
                    entry_status="draft",
                )
            )

            posted_entry_count = (
                self.repository
                .count_entries_by_status(
                    database_session,
                    report_id=report.id,
                    entry_status="posted",
                )
            )

            active_note_count = (
                self.repository
                .count_active_notes(
                    database_session,
                    report.id,
                )
            )

            trial_balance = (
                self.journal_entry_service
                .calculate_trial_balance(
                    database_session,
                    report_id=report.id,
                    as_of=report.period_end,
                )
            )
        except SQLAlchemyError as error:
            raise ReportFinalisationPersistenceError(
                "Finalisation readiness could not be calculated.",
            ) from error
        try:
            tax_reconciliation = (
                self.tax_configuration_service
                .get_reconciliation(
                    database_session,
                    report.id,
                )
            )
        except TaxConfigurationServiceError as error:
            raise ReportFinalisationPersistenceError(
                "Tax finalisation readiness could not be calculated.",
            ) from error

        tax_calculation_count = len(
            tax_reconciliation.calculations,
        )

        draft_tax_calculation_count = sum(
            1
            for calculation
            in tax_reconciliation.calculations
            if calculation.status.value
            == "draft"
        )

        tax_reconciliation_status = (
            tax_reconciliation.status.value
        )

        if posted_entry_count == 0:
            blockers.append(
                FinalisationCheck(
                    code="no_posted_entries",
                    title=(
                        "No posted journal entries"
                    ),
                    detail=(
                        "Post at least one complete journal "
                        "entry before finalising the report."
                    ),
                ),
            )

        if draft_entry_count > 0:
            blockers.append(
                FinalisationCheck(
                    code="draft_entries_exist",
                    title=(
                        "Draft journal entries remain"
                    ),
                    detail=(
                        f"{draft_entry_count} draft journal "
                        "entry or entries must be posted or "
                        "removed before finalisation."
                    ),
                ),
            )

        if not trial_balance.is_balanced:
            blockers.append(
                FinalisationCheck(
                    code="trial_balance_unbalanced",
                    title=(
                        "Trial Balance is not balanced"
                    ),
                    detail=(
                        "Total debit balances must equal "
                        "total credit balances."
                    ),
                ),
            )
        
        if tax_calculation_count == 0:
            warnings.append(
                FinalisationCheck(
                    code="tax_not_configured",
                    title=(
                        "Tax has not been configured"
                    ),
                    detail=(
                        "No tax calculation has been recorded "
                        "for this report. Review whether tax "
                        "configuration is required before "
                        "finalisation."
                    ),
                ),
            )

        if draft_tax_calculation_count > 0:
            warnings.append(
                FinalisationCheck(
                    code=(
                        "draft_tax_calculations"
                    ),
                    title=(
                        "Draft tax calculations remain"
                    ),
                    detail=(
                        f"{draft_tax_calculation_count} tax "
                        "calculation or calculations remain "
                        "in draft status."
                    ),
                ),
            )

        if (
            tax_reconciliation_status
            == "under_posted"
        ):
            warnings.append(
                FinalisationCheck(
                    code="tax_under_posted",
                    title=(
                        "Calculated tax exceeds "
                        "ledger taxation"
                    ),
                    detail=(
                        "Configured taxation exceeds "
                        "the taxation posted to the ledger "
                        f"by {report.currency} "
                        f"{tax_reconciliation.difference:.2f}. "
                        "Review or post the outstanding "
                        "tax adjustment."
                    ),
                ),
            )

        elif (
            tax_reconciliation_status
            == "over_posted"
        ):
            warnings.append(
                FinalisationCheck(
                    code="tax_over_posted",
                    title=(
                        "Ledger taxation exceeds "
                        "calculated tax"
                    ),
                    detail=(
                        "Taxation posted to the ledger "
                        "exceeds configured taxation by "
                        f"{report.currency} "
                        f"{abs(tax_reconciliation.difference):.2f}. "
                        "Review existing tax entries manually."
                    ),
                ),
            )

        if active_note_count == 0:
            warnings.append(
                FinalisationCheck(
                    code="no_active_notes",
                    title=(
                        "No active disclosures"
                    ),
                    detail=(
                        "The report can be finalised, but it "
                        "does not currently contain active "
                        "notes or accounting policies."
                    ),
                ),
            )

        if not (
            report.accountant_report_text
            and report
            .accountant_report_text
            .strip()
        ):
            warnings.append(
                FinalisationCheck(
                    code=(
                        "no_accountant_report_text"
                    ),
                    title=(
                        "Accountant report is empty"
                    ),
                    detail=(
                        "Consider adding the accountant's "
                        "report or preparation statement "
                        "before finalisation."
                    ),
                ),
            )

        return (
            ReportFinalisationReadinessResponse(
                financial_report_id=(
                    report.id
                ),
                report_status=report.status,
                can_finalise=(
                    len(blockers) == 0
                ),
                posted_entry_count=(
                    posted_entry_count
                ),
                draft_entry_count=(
                    draft_entry_count
                ),
                active_note_count=(
                    active_note_count
                ),
                trial_balance_is_balanced=(
                    trial_balance.is_balanced
                ),
                tax_calculation_count=(
                    tax_calculation_count
                ),
                draft_tax_calculation_count=(
                    draft_tax_calculation_count
                ),
                tax_reconciliation_status=(
                    tax_reconciliation_status
                ),
                tax_reconciliation_difference=(
                    tax_reconciliation.difference
                ),
                blockers=blockers,
                warnings=warnings,
                checked_at=utc_now(),
            )
        )

    def build_snapshot(
        self,
        database_session: Session,
        report: FinancialReport,
        *,
        accountant_name: str,
        finalised_by: str,
        approval_notes: str | None,
        finalised_at: datetime,
    ) -> dict[str, Any]:
        company = self.repository.get_company(
            database_session,
            report.company_id,
        )

        if company is None:
            raise ReportFinalisationNotFoundError(
                "The report company was not found.",
            )

        accounts = (
            self.repository
            .list_ledger_accounts(
                database_session,
                report.company_id,
            )
        )

        entries = (
            self.repository
            .list_journal_entries(
                database_session,
                report.id,
            )
        )

        notes = self.repository.list_notes(
            database_session,
            report.id,
        )

        tax_calculations = (
            self.repository
            .list_tax_calculations(
                database_session,
                report.id,
            )
        )

        try:
            tax_reconciliation = (
                self.tax_configuration_service
                .get_reconciliation(
                    database_session,
                    report.id,
                )
            )
        except TaxConfigurationServiceError as error:
            raise ReportFinalisationPersistenceError(
                "Tax reconciliation could not be included in the report snapshot.",
            ) from error

        trial_balance = (
            self.journal_entry_service
            .calculate_trial_balance(
                database_session,
                report_id=report.id,
                as_of=report.period_end,
            )
        )

        snapshot: dict[str, Any] = {
            "snapshot_format_version": 2,
            "finalisation": {
                "finalised_at": (
                    finalised_at.isoformat()
                ),
                "finalised_by": finalised_by,
                "accountant_name": (
                    accountant_name
                ),
                "approval_notes": (
                    approval_notes
                ),
            },
            "company": {
                "id": company.id,
                "name": company.name,
                "business_type": (
                    company.business_type
                ),
                "registration_number": (
                    company
                    .registration_number
                ),
                "tin": company.tin,
                "address": company.address,
                "telephone": (
                    company.telephone
                ),
                "email": company.email,
                "default_currency": (
                    company
                    .default_currency
                ),
                "reporting_basis": (
                    company.reporting_basis
                ),
                "logo_path": (
                    company.logo_path
                ),
            },
            "financial_report": {
                "id": report.id,
                "company_id": (
                    report.company_id
                ),
                "comparison_report_id": (
                    report
                    .comparison_report_id
                ),
                "revision_series_id": (
                    report
                    .revision_series_id
                ),
                "revision_number": (
                    report.revision_number
                ),
                "supersedes_report_id": (
                    report
                    .supersedes_report_id
                ),
                "revision_reason": (
                    report.revision_reason
                ),
                "title": report.title,
                "report_type": (
                    report.report_type
                ),
                "period_start": (
                    report
                    .period_start
                    .isoformat()
                ),
                "period_end": (
                    report
                    .period_end
                    .isoformat()
                ),
                "financial_year": (
                    report.financial_year
                ),
                "currency": (
                    report.currency
                ),
                "business_template": (
                    report
                    .business_template
                ),
                "status": "finalised",
                "accountant_report_text": (
                    report
                    .accountant_report_text
                ),
                "accountant_name": (
                    accountant_name
                ),
                "finalised_by": (
                    finalised_by
                ),
                "finalised_at": (
                    finalised_at.isoformat()
                ),
            },
            "ledger_accounts": [
                {
                    "id": account.id,
                    "company_id": (
                        account.company_id
                    ),
                    "parent_account_id": (
                        account
                        .parent_account_id
                    ),
                    "account_code": (
                        account.account_code
                    ),
                    "account_name": (
                        account.account_name
                    ),
                    "account_type": (
                        account.account_type
                    ),
                    "report_category": (
                        account
                        .report_category
                    ),
                    "cash_flow_category": (
                        account
                        .cash_flow_category
                    ),
                    "normal_balance": (
                        account
                        .normal_balance
                    ),
                    "description": (
                        account.description
                    ),
                    "is_system_account": (
                        account
                        .is_system_account
                    ),
                    "is_cash_equivalent": (
                        account
                        .is_cash_equivalent
                    ),
                    "is_active": (
                        account.is_active
                    ),
                    "display_order": (
                        account
                        .display_order
                    ),
                }
                for account in accounts
            ],
            "journal_entries": [
                {
                    "id": entry.id,
                    "company_id": (
                        entry.company_id
                    ),
                    "financial_report_id": (
                        entry
                        .financial_report_id
                    ),
                    "sequence_number": (
                        entry
                        .sequence_number
                    ),
                    "entry_number": (
                        entry.entry_number
                    ),
                    "entry_date": (
                        entry.entry_date
                        .isoformat()
                    ),
                    "entry_type": (
                        entry.entry_type
                    ),
                    "status": entry.status,
                    "source": entry.source,
                    "description": (
                        entry.description
                    ),
                    "reference": (
                        entry.reference
                    ),
                    "posted_at": (
                        entry.posted_at
                        .isoformat()
                        if entry.posted_at
                        else None
                    ),
                    "voided_at": (
                        entry.voided_at
                        .isoformat()
                        if entry.voided_at
                        else None
                    ),
                    "void_reason": (
                        entry.void_reason
                    ),
                    "lines": [
                        {
                            "id": line.id,
                            "ledger_account_id": (
                                line
                                .ledger_account_id
                            ),
                            "line_number": (
                                line
                                .line_number
                            ),
                            "description": (
                                line.description
                            ),
                            "debit": (
                                serialise_snapshot_value(
                                    line.debit,
                                )
                            ),
                            "credit": (
                                serialise_snapshot_value(
                                    line.credit,
                                )
                            ),
                        }
                        for line in sorted(
                            entry.lines,
                            key=lambda item:
                                item.line_number,
                        )
                    ],
                }
                for entry in entries
            ],
            "tax_calculations": [
                {
                    "id": calculation.id,
                    "financial_report_id": (
                        calculation
                        .financial_report_id
                    ),
                    "tax_rule_id": (
                        calculation.tax_rule_id
                    ),
                    "calculation_date": (
                        calculation
                        .calculation_date
                        .isoformat()
                    ),
                    "tax_base": (
                        serialise_snapshot_value(
                            calculation.tax_base,
                        )
                    ),
                    "tax_amount": (
                        serialise_snapshot_value(
                            calculation.tax_amount,
                        )
                    ),
                    "currency": (
                        calculation.currency
                    ),
                    "rule_code_snapshot": (
                        calculation
                        .rule_code_snapshot
                    ),
                    "rule_name_snapshot": (
                        calculation
                        .rule_name_snapshot
                    ),
                    "tax_type_snapshot": (
                        calculation
                        .tax_type_snapshot
                    ),
                    "calculation_method_snapshot": (
                        calculation
                        .calculation_method_snapshot
                    ),
                    "rate_applied": (
                        serialise_snapshot_value(
                            calculation
                            .rate_applied,
                        )
                        if (
                            calculation
                            .rate_applied
                            is not None
                        )
                        else None
                    ),
                    "fixed_amount_applied": (
                        serialise_snapshot_value(
                            calculation
                            .fixed_amount_applied,
                        )
                        if (
                            calculation
                            .fixed_amount_applied
                            is not None
                        )
                        else None
                    ),
                    "calculation_details_json": (
                        calculation
                        .calculation_details_json
                    ),
                    "status": (
                        calculation.status
                    ),
                    "calculated_at": (
                        calculation
                        .calculated_at
                        .isoformat()
                    ),
                }
                for calculation
                in tax_calculations
            ],
            "tax_reconciliation": (
                tax_reconciliation.model_dump(
                    mode="json",
                    exclude={
                        "calculations",
                        "generated_at",
                    },
                )
            ),
            "trial_balance": (
                trial_balance.model_dump(
                    mode="json",
                )
            ),
        }

        return snapshot

    def finalise_report(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            FinaliseFinancialReportRequest,
    ) -> FinaliseFinancialReportResponse:
        report = self.require_report(
            database_session,
            report_id,
        )

        readiness = self.check_readiness(
            database_session,
            report_id,
        )

        if not readiness.can_finalise:
            blocker_details = "; ".join(
                blocker.detail
                for blocker
                in readiness.blockers
            )

            raise (
                ReportFinalisationValidationError(
                    blocker_details
                    or (
                        "The report is not ready "
                        "for finalisation."
                    ),
                )
            )

        existing_version = (
            self.repository
            .get_version_by_report(
                database_session,
                report.id,
            )
        )

        if existing_version is not None:
            raise ReportFinalisationConflictError(
                "This report already has a finalised version.",
            )

        accountant_name = (
            self.clean_required_text(
                payload.accountant_name,
                "Accountant name",
            )
        )

        finalised_by = (
            self.clean_required_text(
                payload.finalised_by,
                "Finalised by",
            )
        )

        approval_notes = (
            self.clean_optional_text(
                payload.approval_notes,
            )
        )

        finalised_at = utc_now()

        revision_series_id = (
            report.revision_series_id
            or report.id
        )

        report.revision_series_id = (
            revision_series_id
        )

        report.accountant_name = (
            accountant_name
        )

        report.finalised_by = (
            finalised_by
        )

        report.finalised_at = (
            finalised_at
        )

        report.status = "finalised"

        snapshot = self.build_snapshot(
            database_session,
            report,
            accountant_name=(
                accountant_name
            ),
            finalised_by=finalised_by,
            approval_notes=approval_notes,
            finalised_at=finalised_at,
        )

        snapshot_json = json.dumps(
            snapshot,
            ensure_ascii=False,
            sort_keys=True,
            separators=(
                ",",
                ":",
            ),
        )

        snapshot_checksum = sha256(
            snapshot_json.encode(
                "utf-8",
            ),
        ).hexdigest()

        version = FinancialReportVersion(
            financial_report_id=report.id,
            revision_series_id=(
                revision_series_id
            ),
            revision_number=(
                report.revision_number
            ),
            finalised_at=finalised_at,
            finalised_by=finalised_by,
            accountant_name=(
                accountant_name
            ),
            approval_notes=approval_notes,
            snapshot_json=snapshot_json,
            snapshot_checksum=(
                snapshot_checksum
            ),
        )

        database_session.add(report)
        database_session.add(version)

        try:
            database_session.commit()

            database_session.refresh(
                report,
            )

            database_session.refresh(
                version,
            )
        except IntegrityError as error:
            database_session.rollback()

            raise ReportFinalisationConflictError(
                "The report finalisation conflicts with an existing finalised revision.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise ReportFinalisationPersistenceError(
                "The financial report could not be finalised.",
            ) from error

        return FinaliseFinancialReportResponse(
            financial_report_id=(
                report.id
            ),
            report_status=report.status,
            revision_series_id=(
                revision_series_id
            ),
            revision_number=(
                report.revision_number
            ),
            finalised_at=finalised_at,
            accountant_name=(
                accountant_name
            ),
            finalised_by=finalised_by,
            version=self.version_summary(
                version,
            ),
        )

    def get_version(
        self,
        database_session: Session,
        version_id: str,
    ) -> FinancialReportVersionResponse:
        version = self.require_version(
            database_session,
            version_id,
        )

        try:
            snapshot = json.loads(
                version.snapshot_json,
            )
        except json.JSONDecodeError as error:
            raise ReportFinalisationPersistenceError(
                "The stored report snapshot is invalid.",
            ) from error

        return FinancialReportVersionResponse(
            id=version.id,
            financial_report_id=(
                version
                .financial_report_id
            ),
            revision_series_id=(
                version
                .revision_series_id
            ),
            revision_number=(
                version.revision_number
            ),
            finalised_at=(
                version.finalised_at
            ),
            finalised_by=(
                version.finalised_by
            ),
            accountant_name=(
                version.accountant_name
            ),
            snapshot_checksum=(
                version
                .snapshot_checksum
            ),
            created_at=(
                version.created_at
            ),
            approval_notes=(
                version.approval_notes
            ),
            snapshot_json=(
                version.snapshot_json
            ),
            snapshot=snapshot,
        )

    def list_versions(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReportVersionListResponse:
        report = self.require_report(
            database_session,
            report_id,
        )

        revision_series_id = (
            report.revision_series_id
            or report.id
        )

        try:
            versions = (
                self.repository
                .list_versions(
                    database_session,
                    revision_series_id,
                )
            )
        except SQLAlchemyError as error:
            raise ReportFinalisationPersistenceError(
                "Report version history could not be retrieved.",
            ) from error

        return (
            FinancialReportVersionListResponse(
                financial_report_id=(
                    report.id
                ),
                revision_series_id=(
                    revision_series_id
                ),
                items=[
                    self.version_summary(
                        version,
                    )
                    for version
                    in versions
                ],
                total=len(versions),
            )
        )

    def copy_journal_entry(
        self,
        source_entry: JournalEntry,
        *,
        target_report: FinancialReport,
    ) -> JournalEntry:
        copied_lines = [
            JournalLine(
                ledger_account_id=(
                    line
                    .ledger_account_id
                ),
                line_number=(
                    line.line_number
                ),
                description=(
                    line.description
                ),
                debit=line.debit,
                credit=line.credit,
            )
            for line in sorted(
                source_entry.lines,
                key=lambda item:
                    item.line_number,
            )
        ]

        return JournalEntry(
            company_id=(
                target_report.company_id
            ),
            financial_report_id=(
                target_report.id
            ),
            sequence_number=(
                source_entry
                .sequence_number
            ),
            entry_number=(
                source_entry
                .entry_number
            ),
            entry_date=(
                source_entry.entry_date
            ),
            entry_type=(
                source_entry.entry_type
            ),
            status=source_entry.status,
            source=source_entry.source,
            description=(
                source_entry.description
            ),
            reference=(
                source_entry.reference
            ),
            posted_at=(
                source_entry.posted_at
            ),
            voided_at=(
                source_entry.voided_at
            ),
            void_reason=(
                source_entry.void_reason
            ),
            lines=copied_lines,
        )

    def copy_note(
        self,
        source_note:
            FinancialReportNote,
        *,
        target_report_id: str,
    ) -> FinancialReportNote:
        return FinancialReportNote(
            financial_report_id=(
                target_report_id
            ),
            template_id=(
                source_note.template_id
            ),
            note_number=(
                source_note.note_number
            ),
            title=source_note.title,
            note_type=(
                source_note.note_type
            ),
            statement_name=(
                source_note
                .statement_name
            ),
            statement_line_key=(
                source_note
                .statement_line_key
            ),
            content=source_note.content,
            is_active=(
                source_note.is_active
            ),
        )

    def copy_tax_calculation(
        self,
        source_calculation:
            TaxCalculation,
        *,
        target_report_id: str,
        journal_entry_id_map:
            dict[str, str],
    ) -> TaxCalculation:
        """
        Copy a tax calculation into a controlled report revision.

        A confirmed tax calculation may contain the identifier of the
        journal entry created by controlled tax posting. That identifier
        must point to the copied journal in the new revision rather than
        the immutable journal belonging to the original report.
        """

        details: dict[str, Any]

        if (
            source_calculation
            .calculation_details_json
        ):
            try:
                loaded_details = json.loads(
                    source_calculation
                    .calculation_details_json,
                )
            except json.JSONDecodeError:
                loaded_details = {
                    "previous_details_raw": (
                        source_calculation
                        .calculation_details_json
                    ),
                }

            if isinstance(
                loaded_details,
                dict,
            ):
                details = loaded_details
            else:
                details = {
                    "previous_details": (
                        loaded_details
                    ),
                }
        else:
            details = {}

        source_journal_entry_id = (
            details.get(
                "journal_entry_id",
            )
        )

        if isinstance(
            source_journal_entry_id,
            str,
        ):
            copied_journal_entry_id = (
                journal_entry_id_map.get(
                    source_journal_entry_id,
                )
            )

            if copied_journal_entry_id:
                details[
                    "journal_entry_id"
                ] = (
                    copied_journal_entry_id
                )
            else:
                details[
                    "source_journal_entry_id"
                ] = (
                    source_journal_entry_id
                )

                details[
                    "journal_entry_id"
                ] = None

        details[
            "copied_from_tax_calculation_id"
        ] = source_calculation.id

        details[
            "copied_from_report_id"
        ] = (
            source_calculation
            .financial_report_id
        )

        return TaxCalculation(
            financial_report_id=(
                target_report_id
            ),
            tax_rule_id=(
                source_calculation
                .tax_rule_id
            ),
            calculation_date=(
                source_calculation
                .calculation_date
            ),
            tax_base=(
                source_calculation.tax_base
            ),
            tax_amount=(
                source_calculation.tax_amount
            ),
            currency=(
                source_calculation.currency
            ),
            rule_code_snapshot=(
                source_calculation
                .rule_code_snapshot
            ),
            rule_name_snapshot=(
                source_calculation
                .rule_name_snapshot
            ),
            tax_type_snapshot=(
                source_calculation
                .tax_type_snapshot
            ),
            calculation_method_snapshot=(
                source_calculation
                .calculation_method_snapshot
            ),
            rate_applied=(
                source_calculation
                .rate_applied
            ),
            fixed_amount_applied=(
                source_calculation
                .fixed_amount_applied
            ),
            calculation_details_json=(
                json.dumps(
                    details,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(
                        ",",
                        ":",
                    ),
                )
            ),
            status=(
                source_calculation.status
            ),
            calculated_at=(
                source_calculation
                .calculated_at
            ),
        )
    def create_revision(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            CreateFinancialReportRevisionRequest,
    ) -> FinancialReport:
        source_report = self.require_report(
            database_session,
            report_id,
        )

        if (
            source_report.status
            != "finalised"
        ):
            raise ReportFinalisationValidationError(
                "Only a finalised report can be used to create a revision.",
            )

        successor = (
            self.repository
            .get_successor_report(
                database_session,
                source_report.id,
            )
        )

        if successor is not None:
            raise ReportFinalisationConflictError(
                "A revision has already been created from this report.",
            )

        revision_reason = (
            self.clean_required_text(
                payload.revision_reason,
                "Revision reason",
            )
        )

        revision_series_id = (
            source_report
            .revision_series_id
            or source_report.id
        )

        next_revision_number = (
            self.repository
            .max_revision_number(
                database_session,
                revision_series_id,
            )
            + 1
        )

        revised_report = FinancialReport(
            company_id=(
                source_report.company_id
            ),
            comparison_report_id=(
                source_report
                .comparison_report_id
            ),
            revision_series_id=(
                revision_series_id
            ),
            revision_number=(
                next_revision_number
            ),
            supersedes_report_id=(
                source_report.id
            ),
            revision_reason=(
                revision_reason
            ),
            title=(
                payload.title
                or source_report.title
            ),
            report_type=(
                source_report.report_type
            ),
            period_start=(
                source_report.period_start
            ),
            period_end=(
                source_report.period_end
            ),
            financial_year=(
                source_report
                .financial_year
            ),
            currency=(
                source_report.currency
            ),
            business_template=(
                source_report
                .business_template
            ),
            status="draft",
            accountant_report_text=(
                source_report
                .accountant_report_text
            ),
            accountant_name=None,
            finalised_by=None,
            finalised_at=None,
        )

        database_session.add(
            revised_report,
        )

        try:
            database_session.flush()

            source_entries = (
                self.repository
                .list_journal_entries(
                    database_session,
                    source_report.id,
                )
            )

            source_notes = (
                self.repository.list_notes(
                    database_session,
                    source_report.id,
                )
            )

            source_tax_calculations = (
                self.repository
                .list_tax_calculations(
                    database_session,
                    source_report.id,
                )
            )

            copied_entry_pairs: list[
                tuple[
                    str,
                    JournalEntry,
                ]
            ] = []

            for source_entry in (
                source_entries
            ):
                copied_entry = (
                    self.copy_journal_entry(
                        source_entry,
                        target_report=(
                            revised_report
                        ),
                    )
                )

                database_session.add(
                    copied_entry,
                )

                copied_entry_pairs.append(
                    (
                        source_entry.id,
                        copied_entry,
                    ),
                )

            # Flush assigns identifiers to copied journal entries
            # before tax-calculation audit links are rewritten.
            database_session.flush()

            journal_entry_id_map = {
                source_entry_id:
                    copied_entry.id
                for (
                    source_entry_id,
                    copied_entry,
                )
                in copied_entry_pairs
            }

            for source_note in source_notes:
                database_session.add(
                    self.copy_note(
                        source_note,
                        target_report_id=(
                            revised_report.id
                        ),
                    ),
                )

            for source_calculation in (
                source_tax_calculations
            ):
                database_session.add(
                    self.copy_tax_calculation(
                        source_calculation,
                        target_report_id=(
                            revised_report.id
                        ),
                        journal_entry_id_map=(
                            journal_entry_id_map
                        ),
                    ),
                )

            database_session.commit()

            database_session.refresh(
                revised_report,
            )
        except IntegrityError as error:
            database_session.rollback()

            raise ReportFinalisationConflictError(
                "The new report revision conflicts with existing revision data.",
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise ReportFinalisationPersistenceError(
                "The report revision could not be created.",
            ) from error

        return revised_report