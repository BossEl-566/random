import json
from datetime import date
from decimal import (
    Decimal,
    ROUND_HALF_UP,
)

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.financial_report import (
    FinancialReport,
)
from app.models.mixins import utc_now
from app.models.tax_calculation import (
    TaxCalculation,
)
from app.models.tax_profile import TaxProfile
from app.models.tax_rule import TaxRule
from app.repositories.tax_configuration_repository import (
    TaxConfigurationRepository,
)
from app.schemas.journal_entry import (
    JournalEntryCreate,
    JournalEntryResponse,
    JournalEntryType,
    JournalLineInput,
    JournalSource,
)
from app.schemas.tax_configuration import (
    TaxCalculationListResponse,
    TaxCalculationMethod,
    TaxCalculationPreviewRequest,
    TaxCalculationPreviewResponse,
    TaxCalculationResponse,
    TaxProfileCreate,
    TaxProfileListResponse,
    TaxProfileResponse,
    TaxProfileUpdate,
    TaxRuleCreate,
    TaxRuleListResponse,
    TaxRuleResponse,
    TaxRuleRetireRequest,
    TaxRuleStatus,
    TaxRuleUpdate,
    PostTaxAdjustmentRequest,
    PostTaxAdjustmentResponse,
    TaxCalculationStatus,
    TaxReconciliationResponse,
    TaxReconciliationStatus,
)

from app.services.journal_entry_service import (
    JournalEntryPersistenceError,
    JournalEntryService,
    JournalEntryServiceError,
)




MONEY_QUANTUM = Decimal("0.01")

def normalise_money(
    value: Decimal,
) -> Decimal:
    """Round a monetary result consistently to two decimal places."""

    return value.quantize(
        MONEY_QUANTUM,
        rounding=ROUND_HALF_UP,
    )

LOCKED_REPORT_STATUSES = {
    "finalised",
    "printed",
    "archived",
}

ACTIVE_RULE_EDITABLE_FIELDS = {
    "source_reference",
    "notes",
    "display_order",
}


class TaxConfigurationServiceError(
    Exception,
):
    """Base error for tax configuration."""


class TaxConfigurationNotFoundError(
    TaxConfigurationServiceError,
):
    """A required tax resource was not found."""


class TaxConfigurationValidationError(
    TaxConfigurationServiceError,
):
    """Submitted tax configuration is invalid."""


class TaxConfigurationConflictError(
    TaxConfigurationServiceError,
):
    """Submitted tax configuration conflicts with existing data."""


class TaxConfigurationPersistenceError(
    TaxConfigurationServiceError,
):
    """The tax operation could not be saved."""


class TaxConfigurationService:
    def __init__(
        self,
        repository:
            TaxConfigurationRepository
            | None = None,
        journal_entry_service:
            JournalEntryService
            | None = None,
    ) -> None:
        self.repository = (
            repository
            or TaxConfigurationRepository()
        )

        self.journal_entry_service = (
            journal_entry_service
            or JournalEntryService()
        )

    def commit(
        self,
        database_session: Session,
        conflict_message: str,
    ) -> None:
        try:
            database_session.commit()
        except IntegrityError as error:
            database_session.rollback()

            raise TaxConfigurationConflictError(
                conflict_message,
            ) from error
        except SQLAlchemyError as error:
            database_session.rollback()

            raise TaxConfigurationPersistenceError(
                "The tax operation could not be saved.",
            ) from error

    def require_company(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company:
        company = self.repository.get_company(
            database_session,
            company_id,
        )

        if company is None:
            raise TaxConfigurationNotFoundError(
                "The company was not found.",
            )

        return company

    def require_profile(
        self,
        database_session: Session,
        profile_id: str,
    ) -> TaxProfile:
        profile = self.repository.get_profile(
            database_session,
            profile_id,
        )

        if profile is None:
            raise TaxConfigurationNotFoundError(
                "The tax profile was not found.",
            )

        return profile

    def require_rule(
        self,
        database_session: Session,
        rule_id: str,
    ) -> TaxRule:
        rule = self.repository.get_rule(
            database_session,
            rule_id,
        )

        if rule is None:
            raise TaxConfigurationNotFoundError(
                "The tax rule was not found.",
            )

        return rule

    def require_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport:
        report = self.repository.get_report(
            database_session,
            report_id,
        )

        if report is None:
            raise TaxConfigurationNotFoundError(
                "The financial report was not found.",
            )

        return report

    def require_calculation(
        self,
        database_session: Session,
        calculation_id: str,
    ) -> TaxCalculation:
        calculation = (
            self.repository
            .get_calculation(
                database_session,
                calculation_id,
            )
        )

        if calculation is None:
            raise TaxConfigurationNotFoundError(
                "The tax calculation was not found.",
            )

        return calculation

    def ensure_profile_active(
        self,
        profile: TaxProfile,
    ) -> None:
        if not profile.is_active:
            raise TaxConfigurationValidationError(
                "The selected tax profile is inactive.",
            )

    def ensure_report_editable(
        self,
        report: FinancialReport,
    ) -> None:
        if (
            report.status
            in LOCKED_REPORT_STATUSES
        ):
            raise TaxConfigurationConflictError(
                (
                    "Tax calculations cannot be recorded "
                    f"because the report status is "
                    f"'{report.status}'. Create a new "
                    "report revision instead."
                ),
            )

    def validate_rule_values(
        self,
        *,
        calculation_method: str,
        rate_percentage: Decimal | None,
        fixed_amount: Decimal | None,
        effective_from: date,
        effective_to: date | None,
    ) -> None:
        if (
            effective_to is not None
            and effective_to
            < effective_from
        ):
            raise TaxConfigurationValidationError(
                "Effective end date cannot be before the start date.",
            )

        if (
            calculation_method
            == TaxCalculationMethod
            .PERCENTAGE
            .value
        ):
            if rate_percentage is None:
                raise TaxConfigurationValidationError(
                    "Percentage rules require a percentage rate.",
                )

            if fixed_amount is not None:
                raise TaxConfigurationValidationError(
                    "Percentage rules cannot contain a fixed amount.",
                )

            if not (
                Decimal("0")
                <= rate_percentage
                <= Decimal("100")
            ):
                raise TaxConfigurationValidationError(
                    "Percentage rates must be between 0 and 100.",
                )

        elif (
            calculation_method
            == TaxCalculationMethod
            .FIXED_AMOUNT
            .value
        ):
            if fixed_amount is None:
                raise TaxConfigurationValidationError(
                    "Fixed-amount rules require a fixed amount.",
                )

            if fixed_amount < Decimal("0"):
                raise TaxConfigurationValidationError(
                    "Fixed amounts cannot be negative.",
                )

            if rate_percentage is not None:
                raise TaxConfigurationValidationError(
                    "Fixed-amount rules cannot contain a percentage rate.",
                )

        else:
            raise TaxConfigurationValidationError(
                "Unsupported tax calculation method.",
            )

    def ensure_no_overlap(
        self,
        database_session: Session,
        *,
        profile_id: str,
        rule_code: str,
        effective_from: date,
        effective_to: date | None,
        exclude_rule_id: str | None = None,
    ) -> None:
        overlapping_rule = (
            self.repository
            .find_overlapping_rule(
                database_session,
                profile_id=profile_id,
                rule_code=rule_code,
                effective_from=(
                    effective_from
                ),
                effective_to=effective_to,
                exclude_rule_id=(
                    exclude_rule_id
                ),
            )
        )

        if overlapping_rule is not None:
            raise TaxConfigurationConflictError(
                (
                    f"Tax rule {rule_code} overlaps "
                    "an existing effective period "
                    f"beginning "
                    f"{overlapping_rule.effective_from}."
                ),
            )

    def create_profile(
        self,
        database_session: Session,
        payload: TaxProfileCreate,
    ) -> TaxProfileResponse:
        company = self.require_company(
            database_session,
            payload.company_id,
        )

        if not company.is_active:
            raise TaxConfigurationConflictError(
                "A tax profile cannot be created for an inactive company.",
            )

        existing_count = (
            self.repository.count_profiles(
                database_session,
                company.id,
            )
        )

        should_be_default = (
            payload.is_default
            or existing_count == 0
        )

        if (
            should_be_default
            and not payload.is_active
        ):
            raise TaxConfigurationValidationError(
                "An inactive tax profile cannot be the default profile.",
            )

        profile = TaxProfile(
            company_id=company.id,
            profile_code=(
                payload.profile_code
            ),
            profile_name=(
                payload.profile_name
            ),
            jurisdiction_country_code=(
                payload
                .jurisdiction_country_code
            ),
            jurisdiction_name=(
                payload.jurisdiction_name
            ),
            tax_identifier=(
                payload.tax_identifier
            ),
            taxpayer_category=(
                payload.taxpayer_category
            ),
            description=(
                payload.description
            ),
            is_default=(
                should_be_default
            ),
            is_active=(
                payload.is_active
            ),
        )

        if should_be_default:
            self.repository.clear_default_profiles(
                database_session,
                company_id=company.id,
            )

        database_session.add(profile)

        self.commit(
            database_session,
            (
                "A tax profile with this code "
                "or name already exists for the company."
            ),
        )

        database_session.refresh(
            profile,
        )

        return TaxProfileResponse.model_validate(
            profile,
        )

    def list_profiles(
        self,
        database_session: Session,
        *,
        company_id: str,
        include_inactive: bool,
    ) -> TaxProfileListResponse:
        self.require_company(
            database_session,
            company_id,
        )

        profiles = (
            self.repository.list_profiles(
                database_session,
                company_id=company_id,
                include_inactive=(
                    include_inactive
                ),
            )
        )

        return TaxProfileListResponse(
            company_id=company_id,
            items=[
                TaxProfileResponse.model_validate(
                    profile,
                )
                for profile in profiles
            ],
            total=len(profiles),
        )

    def get_profile(
        self,
        database_session: Session,
        profile_id: str,
    ) -> TaxProfileResponse:
        profile = self.require_profile(
            database_session,
            profile_id,
        )

        return TaxProfileResponse.model_validate(
            profile,
        )

    def update_profile(
        self,
        database_session: Session,
        *,
        profile_id: str,
        payload: TaxProfileUpdate,
    ) -> TaxProfileResponse:
        profile = self.require_profile(
            database_session,
            profile_id,
        )

        values = payload.model_dump(
            exclude_unset=True,
        )

        if not values:
            raise TaxConfigurationValidationError(
                "Provide at least one tax-profile field to update.",
            )

        for field_name, value in values.items():
            setattr(
                profile,
                field_name,
                value,
            )

        self.commit(
            database_session,
            (
                "A tax profile with this code "
                "or name already exists for the company."
            ),
        )

        database_session.refresh(
            profile,
        )

        return TaxProfileResponse.model_validate(
            profile,
        )

    def set_default_profile(
        self,
        database_session: Session,
        profile_id: str,
    ) -> TaxProfileResponse:
        profile = self.require_profile(
            database_session,
            profile_id,
        )

        self.ensure_profile_active(
            profile,
        )

        self.repository.clear_default_profiles(
            database_session,
            company_id=profile.company_id,
            exclude_profile_id=profile.id,
        )

        profile.is_default = True

        self.commit(
            database_session,
            "The default tax profile could not be changed.",
        )

        database_session.refresh(
            profile,
        )

        return TaxProfileResponse.model_validate(
            profile,
        )

    def set_profile_active(
        self,
        database_session: Session,
        *,
        profile_id: str,
        is_active: bool,
    ) -> TaxProfileResponse:
        profile = self.require_profile(
            database_session,
            profile_id,
        )

        profile.is_active = is_active

        if not is_active:
            profile.is_default = False

        self.commit(
            database_session,
            "The tax-profile status could not be updated.",
        )

        database_session.refresh(
            profile,
        )

        return TaxProfileResponse.model_validate(
            profile,
        )

    def create_rule(
        self,
        database_session: Session,
        *,
        profile_id: str,
        payload: TaxRuleCreate,
    ) -> TaxRuleResponse:
        profile = self.require_profile(
            database_session,
            profile_id,
        )

        self.ensure_profile_active(
            profile,
        )

        self.validate_rule_values(
            calculation_method=(
                payload
                .calculation_method
                .value
            ),
            rate_percentage=(
                payload.rate_percentage
            ),
            fixed_amount=(
                payload.fixed_amount
            ),
            effective_from=(
                payload.effective_from
            ),
            effective_to=(
                payload.effective_to
            ),
        )

        self.ensure_no_overlap(
            database_session,
            profile_id=profile.id,
            rule_code=payload.rule_code,
            effective_from=(
                payload.effective_from
            ),
            effective_to=(
                payload.effective_to
            ),
        )

        rule = TaxRule(
            tax_profile_id=profile.id,
            rule_code=payload.rule_code,
            rule_name=payload.rule_name,
            tax_type=payload.tax_type,
            calculation_method=(
                payload
                .calculation_method
                .value
            ),
            rate_percentage=(
                payload.rate_percentage
            ),
            fixed_amount=(
                payload.fixed_amount
            ),
            currency=payload.currency,
            effective_from=(
                payload.effective_from
            ),
            effective_to=(
                payload.effective_to
            ),
            taxpayer_category=(
                payload.taxpayer_category
            ),
            business_activity=(
                payload.business_activity
            ),
            status=(
                TaxRuleStatus.DRAFT.value
            ),
            source_reference=(
                payload.source_reference
            ),
            notes=payload.notes,
            is_system_rule=False,
            display_order=(
                payload.display_order
            ),
        )

        database_session.add(rule)

        self.commit(
            database_session,
            (
                "A tax rule with this code "
                "and effective date already exists."
            ),
        )

        database_session.refresh(rule)

        return TaxRuleResponse.model_validate(
            rule,
        )

    def list_rules(
        self,
        database_session: Session,
        *,
        profile_id: str,
        rule_status: TaxRuleStatus | None,
    ) -> TaxRuleListResponse:
        self.require_profile(
            database_session,
            profile_id,
        )

        rules = self.repository.list_rules(
            database_session,
            profile_id=profile_id,
            rule_status=(
                rule_status.value
                if rule_status
                else None
            ),
        )

        return TaxRuleListResponse(
            tax_profile_id=profile_id,
            items=[
                TaxRuleResponse.model_validate(
                    rule,
                )
                for rule in rules
            ],
            total=len(rules),
        )

    def get_rule(
        self,
        database_session: Session,
        rule_id: str,
    ) -> TaxRuleResponse:
        rule = self.require_rule(
            database_session,
            rule_id,
        )

        return TaxRuleResponse.model_validate(
            rule,
        )

    def update_rule(
        self,
        database_session: Session,
        *,
        rule_id: str,
        payload: TaxRuleUpdate,
    ) -> TaxRuleResponse:
        rule = self.require_rule(
            database_session,
            rule_id,
        )

        values = payload.model_dump(
            exclude_unset=True,
        )

        if not values:
            raise TaxConfigurationValidationError(
                "Provide at least one tax-rule field to update.",
            )

        if (
            rule.status
            == TaxRuleStatus.RETIRED.value
        ):
            raise TaxConfigurationConflictError(
                "A retired tax rule cannot be edited.",
            )

        if (
            rule.status
            == TaxRuleStatus.ACTIVE.value
        ):
            prohibited_fields = (
                set(values)
                - ACTIVE_RULE_EDITABLE_FIELDS
            )

            if prohibited_fields:
                raise TaxConfigurationConflictError(
                    (
                        "Active tax-rate configuration "
                        "cannot be changed. Retire the "
                        "rule and create a new effective "
                        "version instead."
                    ),
                )

        proposed_method = (
            values.get(
                "calculation_method",
                rule.calculation_method,
            )
        )

        if isinstance(
            proposed_method,
            TaxCalculationMethod,
        ):
            proposed_method = (
                proposed_method.value
            )

        proposed_rate = values.get(
            "rate_percentage",
            rule.rate_percentage,
        )

        proposed_fixed_amount = (
            values.get(
                "fixed_amount",
                rule.fixed_amount,
            )
        )

        proposed_effective_from = (
            values.get(
                "effective_from",
                rule.effective_from,
            )
        )

        proposed_effective_to = (
            values.get(
                "effective_to",
                rule.effective_to,
            )
        )

        proposed_rule_code = (
            values.get(
                "rule_code",
                rule.rule_code,
            )
        )

        self.validate_rule_values(
            calculation_method=(
                str(proposed_method)
            ),
            rate_percentage=(
                proposed_rate
            ),
            fixed_amount=(
                proposed_fixed_amount
            ),
            effective_from=(
                proposed_effective_from
            ),
            effective_to=(
                proposed_effective_to
            ),
        )

        self.ensure_no_overlap(
            database_session,
            profile_id=(
                rule.tax_profile_id
            ),
            rule_code=(
                str(proposed_rule_code)
            ),
            effective_from=(
                proposed_effective_from
            ),
            effective_to=(
                proposed_effective_to
            ),
            exclude_rule_id=rule.id,
        )

        for field_name, value in values.items():
            if isinstance(
                value,
                TaxCalculationMethod,
            ):
                value = value.value

            setattr(
                rule,
                field_name,
                value,
            )

        self.commit(
            database_session,
            (
                "The tax-rule update conflicts "
                "with an existing rule."
            ),
        )

        database_session.refresh(rule)

        return TaxRuleResponse.model_validate(
            rule,
        )

    def activate_rule(
        self,
        database_session: Session,
        rule_id: str,
    ) -> TaxRuleResponse:
        rule = self.require_rule(
            database_session,
            rule_id,
        )

        profile = self.require_profile(
            database_session,
            rule.tax_profile_id,
        )

        self.ensure_profile_active(
            profile,
        )

        if (
            rule.status
            == TaxRuleStatus.ACTIVE.value
        ):
            return TaxRuleResponse.model_validate(
                rule,
            )

        if (
            rule.status
            == TaxRuleStatus.RETIRED.value
        ):
            raise TaxConfigurationConflictError(
                "A retired tax rule cannot be reactivated.",
            )

        self.ensure_no_overlap(
            database_session,
            profile_id=(
                rule.tax_profile_id
            ),
            rule_code=rule.rule_code,
            effective_from=(
                rule.effective_from
            ),
            effective_to=(
                rule.effective_to
            ),
            exclude_rule_id=rule.id,
        )

        rule.status = (
            TaxRuleStatus.ACTIVE.value
        )

        self.commit(
            database_session,
            "The tax rule could not be activated.",
        )

        database_session.refresh(rule)

        return TaxRuleResponse.model_validate(
            rule,
        )

    def retire_rule(
        self,
        database_session: Session,
        *,
        rule_id: str,
        payload: TaxRuleRetireRequest,
    ) -> TaxRuleResponse:
        rule = self.require_rule(
            database_session,
            rule_id,
        )

        if (
            rule.status
            == TaxRuleStatus.RETIRED.value
        ):
            return TaxRuleResponse.model_validate(
                rule,
            )

        if (
            rule.status
            != TaxRuleStatus.ACTIVE.value
        ):
            raise TaxConfigurationConflictError(
                "Only an active tax rule can be retired.",
            )

        if (
            payload.effective_to
            < rule.effective_from
        ):
            raise TaxConfigurationValidationError(
                "Retirement date cannot be before the rule's effective start date.",
            )

        rule.effective_to = (
            payload.effective_to
        )

        rule.status = (
            TaxRuleStatus.RETIRED.value
        )

        self.commit(
            database_session,
            "The tax rule could not be retired.",
        )

        database_session.refresh(rule)

        return TaxRuleResponse.model_validate(
            rule,
        )

    def get_effective_rule(
        self,
        database_session: Session,
        *,
        profile_id: str,
        rule_code: str,
        calculation_date: date,
    ) -> TaxRuleResponse:
        profile = self.require_profile(
            database_session,
            profile_id,
        )

        self.ensure_profile_active(
            profile,
        )

        rule = (
            self.repository
            .find_effective_rule(
                database_session,
                profile_id=profile.id,
                rule_code=rule_code,
                calculation_date=(
                    calculation_date
                ),
            )
        )

        if rule is None:
            raise TaxConfigurationNotFoundError(
                (
                    f"No effective rule {rule_code} "
                    f"was found for "
                    f"{calculation_date}."
                ),
            )

        return TaxRuleResponse.model_validate(
            rule,
        )

    def calculate_preview(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            TaxCalculationPreviewRequest,
    ) -> TaxCalculationPreviewResponse:
        report = self.require_report(
            database_session,
            report_id,
        )

        profile = self.require_profile(
            database_session,
            payload.tax_profile_id,
        )

        self.ensure_profile_active(
            profile,
        )

        if (
            profile.company_id
            != report.company_id
        ):
            raise TaxConfigurationValidationError(
                "The tax profile must belong to the report company.",
            )

        calculation_date = (
            payload.calculation_date
            or report.period_end
        )

        if not (
            report.period_start
            <= calculation_date
            <= report.period_end
        ):
            raise TaxConfigurationValidationError(
                "Tax calculation date must fall within the report period.",
            )

        rule = (
            self.repository
            .find_effective_rule(
                database_session,
                profile_id=profile.id,
                rule_code=(
                    payload.rule_code
                ),
                calculation_date=(
                    calculation_date
                ),
            )
        )

        if rule is None:
            raise TaxConfigurationNotFoundError(
                (
                    f"No effective rule "
                    f"{payload.rule_code} "
                    f"was found for "
                    f"{calculation_date}."
                ),
            )

        rate_applied: Decimal | None = None
        fixed_amount_applied: Decimal | None = None

        if (
            rule.calculation_method
            == TaxCalculationMethod
            .PERCENTAGE
            .value
        ):
            if rule.rate_percentage is None:
                raise TaxConfigurationPersistenceError(
                    "The effective percentage rule has no rate.",
                )

            rate_applied = Decimal(
                rule.rate_percentage,
            )

            tax_amount = (
                payload.tax_base
                * rate_applied
                / Decimal("100")
            ).quantize(
                MONEY_QUANTUM,
                rounding=ROUND_HALF_UP,
            )

        elif (
            rule.calculation_method
            == TaxCalculationMethod
            .FIXED_AMOUNT
            .value
        ):
            if rule.fixed_amount is None:
                raise TaxConfigurationPersistenceError(
                    "The effective fixed rule has no amount.",
                )

            if (
                rule.currency
                != report.currency
            ):
                raise TaxConfigurationValidationError(
                    (
                        "The fixed-amount rule currency "
                        "must match the report currency."
                    ),
                )

            fixed_amount_applied = Decimal(
                rule.fixed_amount,
            )

            tax_amount = (
                fixed_amount_applied
                .quantize(
                    MONEY_QUANTUM,
                    rounding=(
                        ROUND_HALF_UP
                    ),
                )
            )

        else:
            raise TaxConfigurationPersistenceError(
                "The effective tax rule has an unsupported method.",
            )

        return (
            TaxCalculationPreviewResponse(
                financial_report_id=(
                    report.id
                ),
                tax_profile_id=(
                    profile.id
                ),
                tax_rule_id=rule.id,
                calculation_date=(
                    calculation_date
                ),
                rule_code=(
                    rule.rule_code
                ),
                rule_name=(
                    rule.rule_name
                ),
                tax_type=rule.tax_type,
                calculation_method=(
                    TaxCalculationMethod(
                        rule
                        .calculation_method
                    )
                ),
                tax_base=(
                    payload.tax_base
                    .quantize(
                        MONEY_QUANTUM,
                        rounding=(
                            ROUND_HALF_UP
                        ),
                    )
                ),
                rate_applied=(
                    rate_applied
                ),
                fixed_amount_applied=(
                    fixed_amount_applied
                ),
                tax_amount=tax_amount,
                currency=report.currency,
                generated_at=utc_now(),
            )
        )

    def create_calculation(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            TaxCalculationPreviewRequest,
    ) -> TaxCalculationResponse:
        report = self.require_report(
            database_session,
            report_id,
        )

        self.ensure_report_editable(
            report,
        )

        preview = self.calculate_preview(
            database_session,
            report_id=report_id,
            payload=payload,
        )

        details = {
            "tax_profile_id": (
                preview.tax_profile_id
            ),
            "tax_rule_id": (
                preview.tax_rule_id
            ),
            "rule_code": (
                preview.rule_code
            ),
            "calculation_date": (
                preview
                .calculation_date
                .isoformat()
            ),
            "tax_base": format(
                preview.tax_base,
                "f",
            ),
            "tax_amount": format(
                preview.tax_amount,
                "f",
            ),
        }

        calculation = TaxCalculation(
            financial_report_id=(
                report.id
            ),
            tax_rule_id=(
                preview.tax_rule_id
            ),
            calculation_date=(
                preview.calculation_date
            ),
            tax_base=preview.tax_base,
            tax_amount=(
                preview.tax_amount
            ),
            currency=preview.currency,
            rule_code_snapshot=(
                preview.rule_code
            ),
            rule_name_snapshot=(
                preview.rule_name
            ),
            tax_type_snapshot=(
                preview.tax_type
            ),
            calculation_method_snapshot=(
                preview
                .calculation_method
                .value
            ),
            rate_applied=(
                preview.rate_applied
            ),
            fixed_amount_applied=(
                preview
                .fixed_amount_applied
            ),
            calculation_details_json=(
                json.dumps(
                    details,
                    sort_keys=True,
                    separators=(
                        ",",
                        ":",
                    ),
                )
            ),
            status="draft",
            calculated_at=utc_now(),
        )

        database_session.add(
            calculation,
        )

        self.commit(
            database_session,
            "The tax calculation could not be recorded.",
        )

        database_session.refresh(
            calculation,
        )

        return TaxCalculationResponse.model_validate(
            calculation,
        )

    def list_calculations(
        self,
        database_session: Session,
        report_id: str,
    ) -> TaxCalculationListResponse:
        self.require_report(
            database_session,
            report_id,
        )

        calculations = (
            self.repository
            .list_calculations(
                database_session,
                report_id,
            )
        )

        return TaxCalculationListResponse(
            financial_report_id=(
                report_id
            ),
            items=[
                TaxCalculationResponse
                .model_validate(
                    calculation,
                )
                for calculation
                in calculations
            ],
            total=len(calculations),
        )

    def get_calculation(
        self,
        database_session: Session,
        calculation_id: str,
    ) -> TaxCalculationResponse:
        calculation = (
            self.require_calculation(
                database_session,
                calculation_id,
            )
        )

        return TaxCalculationResponse.model_validate(
            calculation,
        )
    def get_reconciliation(
        self,
        database_session: Session,
        report_id: str,
    ) -> TaxReconciliationResponse:
        """
        Compare configured tax with taxation already posted to the ledger.

        The ledger remains authoritative for the financial statements.
        Configured calculations are advisory until an accounting journal
        has been posted.
        """

        report = self.require_report(
            database_session,
            report_id,
        )

        try:
            trial_balance = (
                self.journal_entry_service
                .calculate_trial_balance(
                    database_session,
                    report_id=report.id,
                    as_of=report.period_end,
                )
            )

            calculations = (
                self.repository
                .list_calculations(
                    database_session,
                    report.id,
                )
            )
        except JournalEntryPersistenceError as error:
            raise TaxConfigurationPersistenceError(
                "Tax reconciliation could not retrieve the Trial Balance.",
            ) from error
        except SQLAlchemyError as error:
            raise TaxConfigurationPersistenceError(
                "Tax reconciliation could not be calculated.",
            ) from error

        ledger_taxation = Decimal(
            "0.00",
        )

        ledger_profit_after_tax = Decimal(
            "0.00",
        )

        for item in trial_balance.items:
            account_type = getattr(
                item.account_type,
                "value",
                item.account_type,
            )

            report_category = getattr(
                item.report_category,
                "value",
                item.report_category,
            )

            account_net_debit = (
                item.debit_balance
                - item.credit_balance
            )

            account_net_credit = (
                item.credit_balance
                - item.debit_balance
            )

            if (
                report_category
                == "taxation"
            ):
                ledger_taxation += (
                    account_net_debit
                )

            if account_type == "revenue":
                ledger_profit_after_tax += (
                    account_net_credit
                )

            elif account_type == "expense":
                ledger_profit_after_tax -= (
                    account_net_debit
                )

        ledger_taxation = normalise_money(
            ledger_taxation,
        )

        ledger_profit_after_tax = (
            normalise_money(
                ledger_profit_after_tax,
            )
        )

        profit_before_tax = (
            normalise_money(
                ledger_profit_after_tax
                + ledger_taxation,
            )
        )

        configured_taxation = (
            normalise_money(
                sum(
                    (
                        calculation.tax_amount
                        for calculation
                        in calculations
                    ),
                    Decimal("0.00"),
                ),
            )
        )

        confirmed_configured_taxation = (
            normalise_money(
                sum(
                    (
                        calculation.tax_amount
                        for calculation
                        in calculations
                        if calculation.status
                        == (
                            TaxCalculationStatus
                            .CONFIRMED
                            .value
                        )
                    ),
                    Decimal("0.00"),
                ),
            )
        )

        draft_configured_taxation = (
            normalise_money(
                sum(
                    (
                        calculation.tax_amount
                        for calculation
                        in calculations
                        if calculation.status
                        == (
                            TaxCalculationStatus
                            .DRAFT
                            .value
                        )
                    ),
                    Decimal("0.00"),
                ),
            )
        )

        difference = normalise_money(
            configured_taxation
            - ledger_taxation,
        )

        configured_profit_after_tax = (
            normalise_money(
                profit_before_tax
                - configured_taxation,
            )
        )

        has_draft_calculations = any(
            calculation.status
            == (
                TaxCalculationStatus
                .DRAFT
                .value
            )
            for calculation
            in calculations
        )

        if not calculations:
            reconciliation_status = (
                TaxReconciliationStatus
                .NOT_CONFIGURED
            )

            requires_attention = False

        elif difference > Decimal(
            "0.00",
        ):
            reconciliation_status = (
                TaxReconciliationStatus
                .UNDER_POSTED
            )

            requires_attention = True

        elif difference < Decimal(
            "0.00",
        ):
            reconciliation_status = (
                TaxReconciliationStatus
                .OVER_POSTED
            )

            requires_attention = True

        else:
            reconciliation_status = (
                TaxReconciliationStatus
                .RECONCILED
            )

            requires_attention = (
                has_draft_calculations
            )

        return TaxReconciliationResponse(
            financial_report_id=(
                report.id
            ),
            currency=report.currency,
            as_of=report.period_end,
            profit_before_tax=(
                profit_before_tax
            ),
            ledger_taxation=(
                ledger_taxation
            ),
            configured_taxation=(
                configured_taxation
            ),
            confirmed_configured_taxation=(
                confirmed_configured_taxation
            ),
            draft_configured_taxation=(
                draft_configured_taxation
            ),
            difference=difference,
            ledger_profit_after_tax=(
                ledger_profit_after_tax
            ),
            configured_profit_after_tax=(
                configured_profit_after_tax
            ),
            status=(
                reconciliation_status
            ),
            requires_attention=(
                requires_attention
            ),
            calculations=[
                TaxCalculationResponse
                .model_validate(
                    calculation,
                )
                for calculation
                in calculations
            ],
            generated_at=utc_now(),
        )

    def post_tax_adjustment(
        self,
        database_session: Session,
        *,
        report_id: str,
        payload:
            PostTaxAdjustmentRequest,
    ) -> PostTaxAdjustmentResponse:
        """
        Post only the outstanding configured tax amount.

        Existing manual taxation entries are preserved. The system does
        not overwrite, reverse or duplicate them.
        """

        report = self.require_report(
            database_session,
            report_id,
        )

        self.ensure_report_editable(
            report,
        )

        reconciliation = (
            self.get_reconciliation(
                database_session,
                report.id,
            )
        )

        if not reconciliation.calculations:
            raise TaxConfigurationValidationError(
                "Record at least one tax calculation before posting taxation.",
            )

        if reconciliation.difference == Decimal(
            "0.00",
        ):
            raise TaxConfigurationConflictError(
                "Configured taxation already agrees with the posted ledger taxation.",
            )

        if reconciliation.difference < Decimal(
            "0.00",
        ):
            raise TaxConfigurationConflictError(
                (
                    "Ledger taxation exceeds configured taxation by "
                    f"{abs(reconciliation.difference):.2f}. "
                    "A controlled automatic posting cannot reduce or "
                    "reverse existing tax journals. Review the existing "
                    "tax entries manually."
                ),
            )

        if (
            reconciliation.ledger_taxation
            > Decimal("0.00")
            and not (
                payload
                .acknowledge_existing_taxation
            )
        ):
            raise TaxConfigurationConflictError(
                (
                    "Taxation has already been posted manually. "
                    "Confirm that the existing taxation has been "
                    "reviewed before posting only the outstanding "
                    "difference."
                ),
            )

        if (
            payload.tax_expense_account_id
            == payload.tax_payable_account_id
        ):
            raise TaxConfigurationValidationError(
                "The tax expense and tax payable accounts must be different.",
            )

        account_ids = {
            payload.tax_expense_account_id,
            payload.tax_payable_account_id,
        }

        try:
            accounts_by_id = (
                self.journal_entry_service
                .validate_accounts(
                    database_session,
                    company_id=(
                        report.company_id
                    ),
                    account_ids=(
                        account_ids
                    ),
                    require_active=True,
                )
            )
        except JournalEntryPersistenceError as error:
            raise TaxConfigurationPersistenceError(
                "The selected tax accounts could not be retrieved.",
            ) from error
        except JournalEntryServiceError as error:
            raise TaxConfigurationValidationError(
                str(error),
            ) from error

        tax_expense_account = (
            accounts_by_id[
                payload
                .tax_expense_account_id
            ]
        )

        tax_payable_account = (
            accounts_by_id[
                payload
                .tax_payable_account_id
            ]
        )

        if (
            tax_expense_account.account_type
            != "expense"
            or (
                tax_expense_account
                .report_category
                != "taxation"
            )
        ):
            raise TaxConfigurationValidationError(
                (
                    "The selected tax expense account must be "
                    "an expense account classified under taxation."
                ),
            )

        if (
            tax_payable_account.account_type
            != "liability"
            or (
                tax_payable_account
                .report_category
                != "current_liabilities"
            )
        ):
            raise TaxConfigurationValidationError(
                (
                    "The selected tax payable account must be "
                    "a current-liability account."
                ),
            )

        posting_date = (
            payload.entry_date
            or report.period_end
        )

        adjustment_amount = (
            reconciliation.difference
        )

        journal_payload = (
            JournalEntryCreate(
                entry_date=posting_date,
                entry_type=(
                    JournalEntryType
                    .ADJUSTING
                ),
                source=(
                    JournalSource.SYSTEM
                ),
                description=(
                    "Configured tax adjustment: "
                    f"{payload.reason}"
                ),
                reference=(
                    "TAX-ADJ-"
                    f"{report.financial_year}"
                ),
                lines=[
                    JournalLineInput(
                        ledger_account_id=(
                            tax_expense_account.id
                        ),
                        description=(
                            "Current income tax expense"
                        ),
                        debit=(
                            adjustment_amount
                        ),
                        credit=Decimal(
                            "0.00",
                        ),
                    ),
                    JournalLineInput(
                        ledger_account_id=(
                            tax_payable_account.id
                        ),
                        description=(
                            "Current income tax payable"
                        ),
                        debit=Decimal(
                            "0.00",
                        ),
                        credit=(
                            adjustment_amount
                        ),
                    ),
                ],
            )
        )

        try:
            journal_entry = (
                self.journal_entry_service
                .create_entry(
                    database_session,
                    report.id,
                    journal_payload,
                )
            )

            posted_entry = (
                self.journal_entry_service
                .post_entry(
                    database_session,
                    journal_entry.id,
                )
            )
        except JournalEntryPersistenceError as error:
            raise TaxConfigurationPersistenceError(
                "The tax-adjustment journal could not be saved.",
            ) from error
        except JournalEntryServiceError as error:
            raise TaxConfigurationConflictError(
                str(error),
            ) from error

        calculations = (
            self.repository
            .list_calculations(
                database_session,
                report.id,
            )
        )

        for calculation in calculations:
            if (
                calculation.status
                != (
                    TaxCalculationStatus
                    .DRAFT
                    .value
                )
            ):
                continue

            try:
                details = (
                    json.loads(
                        calculation
                        .calculation_details_json
                    )
                    if (
                        calculation
                        .calculation_details_json
                    )
                    else {}
                )
            except json.JSONDecodeError:
                details = {}

            if not isinstance(
                details,
                dict,
            ):
                details = {
                    "previous_details": (
                        details
                    ),
                }

            details.update(
                {
                    "journal_entry_id": (
                        posted_entry.id
                    ),
                    "journal_entry_number": (
                        posted_entry
                        .entry_number
                    ),
                    "posted_adjustment": (
                        format(
                            adjustment_amount,
                            "f",
                        )
                    ),
                    "posting_reason": (
                        payload.reason
                    ),
                    "posted_at": (
                        posted_entry
                        .posted_at
                        .isoformat()
                        if (
                            posted_entry
                            .posted_at
                        )
                        else None
                    ),
                },
            )

            calculation.status = (
                TaxCalculationStatus
                .CONFIRMED
                .value
            )

            calculation.calculation_details_json = (
                json.dumps(
                    details,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(
                        ",",
                        ":",
                    ),
                )
            )

            database_session.add(
                calculation,
            )

        self.commit(
            database_session,
            "The tax calculations could not be confirmed after posting.",
        )

        refreshed_reconciliation = (
            self.get_reconciliation(
                database_session,
                report.id,
            )
        )

        return PostTaxAdjustmentResponse(
            journal_entry=(
                JournalEntryResponse
                .model_validate(
                    posted_entry,
                )
            ),
            reconciliation=(
                refreshed_reconciliation
            ),
        )