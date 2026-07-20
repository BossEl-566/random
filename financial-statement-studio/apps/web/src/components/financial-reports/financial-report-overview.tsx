"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import {
  listCompanies,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import type {
  Company,
} from "@/types/company";
import {
  REPORT_STATUS_OPTIONS,
  REPORT_TYPE_OPTIONS,
  type FinancialReport,
} from "@/types/financial-report";

type FinancialReportOverviewProps = {
  reportId: string;
};

type OverviewState =
  | {
      status: "loading";
      report: null;
      company: null;
      message: null;
    }
  | {
      status: "ready";
      report: FinancialReport;
      company: Company | null;
      message: null;
    }
  | {
      status: "error";
      report: null;
      company: null;
      message: string;
    };

const initialState: OverviewState = {
  status: "loading",
  report: null,
  company: null,
  message: null,
};

function getLabel(
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
      dateStyle: "long",
    },
  ).format(date);
}

export function FinancialReportOverview({
  reportId,
}: FinancialReportOverviewProps) {
  const [state, setState] =
    useState<OverviewState>(
      initialState,
    );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getFinancialReport(reportId),
      listCompanies({
        includeInactive: true,
        offset: 0,
        limit: 100,
      }),
    ])
      .then(
        ([
          report,
          companyResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          const company =
            companyResponse.items.find(
              (candidate) =>
                candidate.id ===
                report.company_id,
            ) ?? null;

          setState({
            status: "ready",
            report,
            company,
            message: null,
          });
        },
      )
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          report: null,
          company: null,
          message:
            error instanceof Error
              ? error.message
              : "The financial report could not be loaded.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (state.status === "loading") {
    return (
      <main className="report-overview-page">
        <div className="report-overview-loading">
          Loading financial report...
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="report-overview-page">
        <div className="report-state-card report-state-card--error">
          <span>
            Report unavailable
          </span>

          <h2>
            The financial report could not
            be opened
          </h2>

          <p>{state.message}</p>

          <Link
            className="primary-button"
            href="/reports"
          >
            Return to reports
          </Link>
        </div>
      </main>
    );
  }

  const {
    report,
    company,
  } = state;

  return (
    <main className="report-overview-page">
      <header className="app-topbar">
        <Link
          className="app-brand"
          href="/reports"
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              Report workspace
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href="/reports"
          >
            All reports
          </Link>

          <Link
            className="topbar-link"
            href="/companies"
          >
            Companies
          </Link>
        </div>
      </header>

      <section className="report-overview-hero">
        <div>
          <p className="eyebrow">
            {company?.name ??
              "Financial report"}
          </p>

          <h1>{report.title}</h1>

          <p>
            {formatDate(
              report.period_start,
            )}
            {" to "}
            {formatDate(
              report.period_end,
            )}
          </p>
        </div>

        <div className="report-overview-hero__status">
          <span>Status</span>

          <strong>
            {getLabel(
              REPORT_STATUS_OPTIONS,
              report.status,
            )}
          </strong>
        </div>
      </section>

      <section className="report-overview-summary">
        <div>
          <span>Report type</span>
          <strong>
            {getLabel(
              REPORT_TYPE_OPTIONS,
              report.report_type,
            )}
          </strong>
        </div>

        <div>
          <span>Financial year</span>
          <strong>
            {report.financial_year}
          </strong>
        </div>

        <div>
          <span>Currency</span>
          <strong>
            {report.currency}
          </strong>
        </div>

        <div>
          <span>Business template</span>
          <strong>
            {report.business_template}
          </strong>
        </div>
      </section>

      <section className="report-editor-placeholder">
        <p className="eyebrow">
          Next development phase
        </p>

        <h2>
          Financial statement editor
        </h2>

        <p>
          This report document is saved and
          ready. The next phase will add the
          chart of accounts, guided financial
          data entry and automatic statement
          calculations.
        </p>

        <div className="report-placeholder-grid">
          <article>
            <span>01</span>
            <h3>
              Chart of accounts
            </h3>
            <p>
              Accounts will be selected from
              the report’s business template.
            </p>
          </article>

          <article>
            <span>02</span>
            <h3>
              Financial data entry
            </h3>
            <p>
              The user will enter balances
              while the system calculates
              totals.
            </p>
          </article>

          <article>
            <span>03</span>
            <h3>
              Statement preview
            </h3>
            <p>
              Generated financial statements
              will be validated before
              printing.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}