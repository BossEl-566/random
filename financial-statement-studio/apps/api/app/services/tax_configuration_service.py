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
)


MONEY_QUANTUM = Decimal("0.01")

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
    ) -> None:
        self.repository = (
            repository
            or TaxConfigurationRepository()
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