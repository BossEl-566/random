from datetime import date

from sqlalchemy import (
    and_,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.financial_report import (
    FinancialReport,
)
from app.models.tax_calculation import (
    TaxCalculation,
)
from app.models.tax_profile import TaxProfile
from app.models.tax_rule import TaxRule


class TaxConfigurationRepository:
    def get_company(
        self,
        database_session: Session,
        company_id: str,
    ) -> Company | None:
        return database_session.get(
            Company,
            company_id,
        )

    def get_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport | None:
        return database_session.get(
            FinancialReport,
            report_id,
        )

    def get_profile(
        self,
        database_session: Session,
        profile_id: str,
    ) -> TaxProfile | None:
        return database_session.get(
            TaxProfile,
            profile_id,
        )

    def get_rule(
        self,
        database_session: Session,
        rule_id: str,
    ) -> TaxRule | None:
        return database_session.get(
            TaxRule,
            rule_id,
        )

    def get_calculation(
        self,
        database_session: Session,
        calculation_id: str,
    ) -> TaxCalculation | None:
        return database_session.get(
            TaxCalculation,
            calculation_id,
        )

    def count_profiles(
        self,
        database_session: Session,
        company_id: str,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(TaxProfile)
            .where(
                TaxProfile.company_id
                == company_id,
            )
        )

        return int(
            database_session.scalar(
                statement,
            )
            or 0,
        )

    def list_profiles(
        self,
        database_session: Session,
        *,
        company_id: str,
        include_inactive: bool,
    ) -> list[TaxProfile]:
        statement = select(
            TaxProfile,
        ).where(
            TaxProfile.company_id
            == company_id,
        )

        if not include_inactive:
            statement = statement.where(
                TaxProfile.is_active
                .is_(True),
            )

        statement = statement.order_by(
            TaxProfile.is_default.desc(),
            TaxProfile.profile_name.asc(),
            TaxProfile.created_at.asc(),
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def clear_default_profiles(
        self,
        database_session: Session,
        *,
        company_id: str,
        exclude_profile_id: str | None = None,
    ) -> None:
        profiles = self.list_profiles(
            database_session,
            company_id=company_id,
            include_inactive=True,
        )

        for profile in profiles:
            if (
                exclude_profile_id
                and profile.id
                == exclude_profile_id
            ):
                continue

            profile.is_default = False

    def list_rules(
        self,
        database_session: Session,
        *,
        profile_id: str,
        rule_status: str | None,
    ) -> list[TaxRule]:
        statement = select(
            TaxRule,
        ).where(
            TaxRule.tax_profile_id
            == profile_id,
        )

        if rule_status:
            statement = statement.where(
                TaxRule.status
                == rule_status,
            )

        statement = statement.order_by(
            TaxRule.display_order.asc(),
            TaxRule.rule_code.asc(),
            TaxRule.effective_from.desc(),
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def find_overlapping_rule(
        self,
        database_session: Session,
        *,
        profile_id: str,
        rule_code: str,
        effective_from: date,
        effective_to: date | None,
        exclude_rule_id: str | None = None,
    ) -> TaxRule | None:
        """
        Find an existing rule whose effective period overlaps
        the proposed effective period.

        Date ranges are inclusive:

            existing_start <= proposed_end
            and
            existing_end >= proposed_start

        A null end date represents an open-ended period.
        """

        filters = [
            TaxRule.tax_profile_id
            == profile_id,

            TaxRule.rule_code
            == rule_code,

            # Existing rule must not end before
            # the proposed rule begins.
            or_(
                TaxRule.effective_to.is_(None),
                TaxRule.effective_to
                >= effective_from,
            ),
        ]

        # An open-ended proposed rule has no upper
        # boundary, so this comparison must only be
        # added when an actual end date exists.
        if effective_to is not None:
            filters.append(
                TaxRule.effective_from
                <= effective_to,
            )

        if exclude_rule_id is not None:
            filters.append(
                TaxRule.id
                != exclude_rule_id,
            )

        statement = (
            select(TaxRule)
            .where(*filters)
            .order_by(
                TaxRule.effective_from.asc(),
                TaxRule.created_at.asc(),
            )
        )

        return database_session.scalar(
            statement,
        )

    def find_effective_rule(
        self,
        database_session: Session,
        *,
        profile_id: str,
        rule_code: str,
        calculation_date: date,
    ) -> TaxRule | None:
        statement = (
            select(TaxRule)
            .where(
                TaxRule.tax_profile_id
                == profile_id,
                TaxRule.rule_code
                == rule_code,
                TaxRule.status.in_(
                    [
                        "active",
                        "retired",
                    ],
                ),
                TaxRule.effective_from
                <= calculation_date,
                or_(
                    TaxRule.effective_to
                    .is_(None),
                    TaxRule.effective_to
                    >= calculation_date,
                ),
            )
            .order_by(
                TaxRule.effective_from.desc(),
            )
        )

        return database_session.scalar(
            statement,
        )

    def list_calculations(
        self,
        database_session: Session,
        report_id: str,
    ) -> list[TaxCalculation]:
        statement = (
            select(TaxCalculation)
            .where(
                TaxCalculation
                .financial_report_id
                == report_id,
            )
            .order_by(
                TaxCalculation
                .calculation_date
                .desc(),
                TaxCalculation
                .created_at
                .desc(),
            )
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )