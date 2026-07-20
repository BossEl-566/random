"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import { FinancialReportCard } from "@/components/financial-reports/financial-report-card";
import { FinancialReportEditor } from "@/components/financial-reports/financial-report-editor";
import {
  listCompanies,
} from "@/lib/companies-api";
import {
  listFinancialReports,
} from "@/lib/financial-reports-api";
import type {
  Company,
} from "@/types/company";
import {
  REPORT_STATUS_OPTIONS,
  type FinancialReport,
  type ReportStatus,
} from "@/types/financial-report";

type FinancialReportWorkspaceProps = {
  initialCompanyId?: string;
};

type EditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      report: FinancialReport;
    }
  | null;

type ResourceState =
  | "loading"
  | "ready"
  | "error";

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function FinancialReportWorkspace({
  initialCompanyId = "",
}: FinancialReportWorkspaceProps) {
  const [companies, setCompanies] =
    useState<Company[]>([]);

  const [reports, setReports] =
    useState<FinancialReport[]>([]);

  const [total, setTotal] =
    useState(0);

  const [resourceState, setResourceState] =
    useState<ResourceState>("loading");

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [
    selectedCompanyId,
    setSelectedCompanyId,
  ] = useState(initialCompanyId);

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState<ReportStatus | "">("");

  const [reloadVersion, setReloadVersion] =
    useState(0);

  const [editorState, setEditorState] =
    useState<EditorState>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listCompanies({
        includeInactive: false,
        offset: 0,
        limit: 100,
      }),
      listFinancialReports({
        companyId:
          selectedCompanyId || undefined,
        search:
          appliedSearch || undefined,
        status:
          selectedStatus || undefined,
        offset: 0,
        limit: 100,
      }),
    ])
      .then(
        ([
          companyResponse,
          reportResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          setCompanies(
            companyResponse.items,
          );
          setReports(
            reportResponse.items,
          );
          setTotal(
            reportResponse.total,
          );
          setResourceState("ready");
        },
      )
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setResourceState("error");
        setLoadError(
          getErrorMessage(
            error,
            "Financial reports could not be loaded.",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    appliedSearch,
    reloadVersion,
    selectedCompanyId,
    selectedStatus,
  ]);

  function requestReload(): void {
    setResourceState("loading");
    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    const nextSearch =
      searchInput.trim();

    setResourceState("loading");
    setLoadError(null);

    if (nextSearch === appliedSearch) {
      setReloadVersion(
        (currentVersion) =>
          currentVersion + 1,
      );
      return;
    }

    setAppliedSearch(nextSearch);
  }

  function clearFilters(): void {
    setSearchInput("");
    setResourceState("loading");
    setLoadError(null);
    setAppliedSearch("");
    setSelectedCompanyId("");
    setSelectedStatus("");
    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  function handleCompanyFilter(
    companyId: string,
  ): void {
    setResourceState("loading");
    setLoadError(null);
    setSelectedCompanyId(companyId);
  }

  function handleStatusFilter(
    reportStatus: ReportStatus | "",
  ): void {
    setResourceState("loading");
    setLoadError(null);
    setSelectedStatus(reportStatus);
  }

  function handleReportSaved(): void {
    setEditorState(null);
    requestReload();
  }

  const companyNames = new Map(
    companies.map((company) => [
      company.id,
      company.name,
    ]),
  );

  const reportTitles = new Map(
    reports.map((report) => [
      report.id,
      report.title,
    ]),
  );

  const filtersApplied =
    Boolean(
      appliedSearch ||
      selectedCompanyId ||
      selectedStatus,
    );

  return (
    <main className="reports-page">
      <header className="app-topbar">
        <Link
          className="app-brand"
          href="/"
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              Financial reports
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href="/companies"
          >
            Companies
          </Link>

          <Link
            className="topbar-link"
            href="/"
          >
            System status
          </Link>
        </div>
      </header>

      <section className="reports-hero">
        <div>
          <p className="eyebrow">
            Financial documents
          </p>

          <h1>
            Prepare, manage and review
            financial reports.
          </h1>

          <p>
            Each document belongs to one
            company and reporting period.
            Reports remain separate so one
            year never overwrites another.
          </p>
        </div>

        <div className="reports-hero__summary">
          <span>
            Available reports
          </span>

          <strong>
            {resourceState === "ready"
              ? total
              : "—"}
          </strong>

          <button
            className="primary-button"
            type="button"
            disabled={
              resourceState === "ready" &&
              companies.length === 0
            }
            onClick={() =>
              setEditorState({
                mode: "create",
              })
            }
          >
            New financial report
          </button>
        </div>
      </section>

      <section className="reports-toolbar">
        <form
          className="reports-search"
          onSubmit={handleSearch}
        >
          <label htmlFor="report-search">
            Search report titles
          </label>

          <div className="reports-search__controls">
            <input
              id="report-search"
              type="search"
              value={searchInput}
              placeholder="Example: 2025 financial statements"
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
            />

            <button
              type="submit"
              className="reports-search__button"
            >
              Search
            </button>
          </div>
        </form>

        <label className="reports-filter">
          <span>Company</span>

          <select
            value={selectedCompanyId}
            onChange={(event) =>
              handleCompanyFilter(
                event.target.value,
              )
            }
          >
            <option value="">
              All companies
            </option>

            {companies.map(
              (company) => (
                <option
                  value={company.id}
                  key={company.id}
                >
                  {company.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="reports-filter">
          <span>Status</span>

          <select
            value={selectedStatus}
            onChange={(event) =>
              handleStatusFilter(
                event.target
                  .value as ReportStatus | "",
              )
            }
          >
            <option value="">
              All active statuses
            </option>

            {REPORT_STATUS_OPTIONS.filter(
              (option) =>
                option.value !== "archived",
            ).map((option) => (
              <option
                value={option.value}
                key={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="reports-toolbar__actions">
          <button
            className="text-button"
            type="button"
            disabled={
              resourceState === "loading"
            }
            onClick={requestReload}
          >
            Refresh
          </button>

          {filtersApplied ? (
            <button
              className="text-button"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <section
        className="reports-content"
        aria-busy={
          resourceState === "loading"
        }
      >
        {resourceState === "loading" ? (
          <div className="report-loading-grid">
            {[1, 2, 3].map(
              (placeholder) => (
                <div
                  className="report-card report-card--loading"
                  key={placeholder}
                >
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ),
            )}
          </div>
        ) : null}

        {resourceState === "error" ? (
          <div className="report-state-card report-state-card--error">
            <span>
              Connection problem
            </span>

            <h2>
              Financial reports could not
              be loaded
            </h2>

            <p>{loadError}</p>

            <button
              className="primary-button"
              type="button"
              onClick={requestReload}
            >
              Try again
            </button>
          </div>
        ) : null}

        {resourceState === "ready" &&
        companies.length === 0 ? (
          <div className="report-state-card">
            <span>
              Company required
            </span>

            <h2>
              Create a company before
              preparing a report
            </h2>

            <p>
              Every financial report must
              belong to a business or
              organisation.
            </p>

            <Link
              className="primary-button"
              href="/companies"
            >
              Create a company
            </Link>
          </div>
        ) : null}

        {resourceState === "ready" &&
        companies.length > 0 &&
        reports.length === 0 ? (
          <div className="report-state-card">
            <span>
              {filtersApplied
                ? "No matching reports"
                : "No reports yet"}
            </span>

            <h2>
              {filtersApplied
                ? "No report matches the selected filters"
                : "Create your first financial report"}
            </h2>

            <p>
              {filtersApplied
                ? "Change or clear the current filters and try again."
                : "Select a company and reporting period to create a separate financial document."}
            </p>

            {filtersApplied ? (
              <button
                className="secondary-button"
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  setEditorState({
                    mode: "create",
                  })
                }
              >
                Create first report
              </button>
            )}
          </div>
        ) : null}

        {resourceState === "ready" &&
        reports.length > 0 ? (
          <>
            <div className="reports-content__heading">
              <div>
                <p className="eyebrow">
                  Financial documents
                </p>

                <h2>
                  {total === 1
                    ? "1 report"
                    : `${total} reports`}
                </h2>
              </div>

              <p>
                Open a report to continue
                entering financial
                information or edit its
                setup details.
              </p>
            </div>

            <div className="reports-grid">
              {reports.map((report) => (
                <FinancialReportCard
                  report={report}
                  companyName={
                    companyNames.get(
                      report.company_id,
                    ) ??
                    "Unknown company"
                  }
                  comparisonTitle={
                    report.comparison_report_id
                      ? reportTitles.get(
                          report.comparison_report_id,
                        ) ?? "Earlier report"
                      : null
                  }
                  key={report.id}
                  onEdit={(
                    selectedReport,
                  ) =>
                    setEditorState({
                      mode: "edit",
                      report:
                        selectedReport,
                    })
                  }
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <footer className="company-page__footer">
        <span>
          Financial Statement Studio
        </span>

        <span>
          Reports are stored locally in
          SQLite.
        </span>
      </footer>

      {editorState ? (
        <FinancialReportEditor
          key={
            editorState.mode === "edit"
              ? editorState.report.id
              : `new-report-${
                  selectedCompanyId ||
                  initialCompanyId ||
                  "general"
                }`
          }
          companies={companies}
          reports={reports}
          report={
            editorState.mode === "edit"
              ? editorState.report
              : null
          }
          initialCompanyId={
            selectedCompanyId ||
            initialCompanyId
          }
          onClose={() =>
            setEditorState(null)
          }
          onSaved={
            handleReportSaved
          }
        />
      ) : null}
    </main>
  );
}