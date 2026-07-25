from sqlalchemy import (
    Select,
    func,
    select,
)
from sqlalchemy.orm import Session

from app.models.disclosure_template import (
    DisclosureTemplate,
)
from app.models.financial_report import (
    FinancialReport,
)
from app.models.financial_report_note import (
    FinancialReportNote,
)


class NotesRepository:
    def get_financial_report(
        self,
        database_session: Session,
        report_id: str,
    ) -> FinancialReport | None:
        return database_session.get(
            FinancialReport,
            report_id,
        )

    def get_template(
        self,
        database_session: Session,
        template_id: str,
    ) -> DisclosureTemplate | None:
        return database_session.get(
            DisclosureTemplate,
            template_id,
        )

    def get_template_by_key(
        self,
        database_session: Session,
        template_key: str,
    ) -> DisclosureTemplate | None:
        statement = select(
            DisclosureTemplate,
        ).where(
            DisclosureTemplate.template_key
            == template_key,
        )

        return database_session.scalar(
            statement,
        )

    def list_templates(
        self,
        database_session: Session,
        *,
        include_inactive: bool,
        note_type: str | None,
    ) -> list[DisclosureTemplate]:
        statement: Select[
            tuple[DisclosureTemplate]
        ] = select(
            DisclosureTemplate,
        )

        if not include_inactive:
            statement = statement.where(
                DisclosureTemplate.is_active
                .is_(True),
            )

        if note_type is not None:
            statement = statement.where(
                DisclosureTemplate.note_type
                == note_type,
            )

        statement = statement.order_by(
            DisclosureTemplate
            .display_order
            .asc(),
            DisclosureTemplate.title.asc(),
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def get_note(
        self,
        database_session: Session,
        note_id: str,
    ) -> FinancialReportNote | None:
        return database_session.get(
            FinancialReportNote,
            note_id,
        )

    def list_notes(
        self,
        database_session: Session,
        *,
        report_id: str,
        include_inactive: bool,
    ) -> list[FinancialReportNote]:
        statement: Select[
            tuple[FinancialReportNote]
        ] = select(
            FinancialReportNote,
        ).where(
            FinancialReportNote
            .financial_report_id
            == report_id,
        )

        if not include_inactive:
            statement = statement.where(
                FinancialReportNote
                .is_active
                .is_(True),
            )

        statement = statement.order_by(
            FinancialReportNote
            .note_number
            .asc(),
            FinancialReportNote
            .created_at
            .asc(),
        )

        return list(
            database_session.scalars(
                statement,
            ).all(),
        )

    def max_note_number(
        self,
        database_session: Session,
        report_id: str,
    ) -> int:
        statement = select(
            func.max(
                FinancialReportNote
                .note_number,
            ),
        ).where(
            FinancialReportNote
            .financial_report_id
            == report_id,
        )

        result = database_session.scalar(
            statement,
        )

        return int(result or 0)