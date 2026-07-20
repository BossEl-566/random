import Link from "next/link";

import {
  BUSINESS_TYPE_OPTIONS,
} from "@/types/company";
import {
  REPORT_STATUS_OPTIONS,
  REPORT_TYPE_OPTIONS,
  type FinancialReport,
} from "@/types/financial-report";

type FinancialReportCardProps = {
  report: FinancialReport;
  companyName: string;
  comparisonTitle: string | null;
  onEdit: (
    report: FinancialReport,
  ) => void;
};

function getOptionLabel(
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>,
  value: string,
): string {
  return (
    options.find(
      (option) =>
        option.value === value,
    )?.label ?? value
  );
}

function formatDate(
  value: string,
): string {
  const date = new Date(
    `${value}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GH",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

export function FinancialReportCard({
  report,
  companyName,
  comparisonTitle,
  onEdit,
}: FinancialReportCardProps) {
  return (
    <article className="report-card">
      <div className="report-card__top">
        <span
          className={`report-status report-status--${report.status}`}
        >
          {getOptionLabel(
            REPORT_STATUS_OPTIONS,
            report.status,
          )}
        </span>

        <span className="report-year">
          {report.financial_year}
        </span>
      </div>

      <div className="report-card__heading">
        <p>{companyName}</p>
        <h3>{report.title}</h3>
      </div>

      <dl className="report-card__details">
        <div>
          <dt>Report type</dt>
          <dd>
            {getOptionLabel(
              REPORT_TYPE_OPTIONS,
              report.report_type,
            )}
          </dd>
        </div>

        <div>
          <dt>Reporting period</dt>
          <dd>
            {formatDate(
              report.period_start,
            )}
            {" – "}
            {formatDate(
              report.period_end,
            )}
          </dd>
        </div>

        <div>
          <dt>Currency</dt>
          <dd>{report.currency}</dd>
        </div>

        <div>
          <dt>Business template</dt>
          <dd>
            {getOptionLabel(
              BUSINESS_TYPE_OPTIONS,
              report.business_template,
            )}
          </dd>
        </div>
      </dl>

      <div className="report-card__comparison">
        <span>
          Comparative report
        </span>

        <p>
          {comparisonTitle ??
            "No comparative period selected"}
        </p>
      </div>

      <div className="report-card__actions">
        <Link
          className="report-action-button report-action-button--primary"
          href={`/reports/${report.id}`}
        >
          Open workspace
        </Link>

        <button
          className="report-action-button"
          type="button"
          onClick={() =>
            onEdit(report)
          }
        >
          Edit setup
        </button>
      </div>
    </article>
  );
}