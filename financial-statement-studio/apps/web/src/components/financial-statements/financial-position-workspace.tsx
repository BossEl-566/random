"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { StatementSection } from "@/components/financial-statements/statement-section";
import {
  formatStatementDate,
  formatStatementMoney,
} from "@/components/financial-statements/statement-utils";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  getStatementOfFinancialPosition,
} from "@/lib/financial-statements-api";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import type {
  FinancialStatementSection,
  StatementOfFinancialPosition,
} from "@/types/financial-statement";
import { StatementPrintActions } from "@/components/financial-statements/statement-print-actions";

type FinancialPositionWorkspaceProps = {
  reportId: string;
};

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

export function FinancialPositionWorkspace({
  reportId,
}: FinancialPositionWorkspaceProps) {
  const [report, setReport] =
    useState<FinancialReport | null>(
      null,
    );

  const [company, setCompany] =
    useState<Company | null>(null);

  const [
    statement,
    setStatement,
  ] = useState<StatementOfFinancialPosition | null>(
    null,
  );

  const [
    resourceState,
    setResourceState,
  ] = useState<ResourceState>(
    "loading",
  );

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    asOfInput,
    setAsOfInput,
  ] = useState("");

  const [
    appliedAsOf,
    setAppliedAsOf,
  ] = useState("");

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getFinancialReport(reportId)
      .then(
        (reportResponse) =>
          Promise.all([
            Promise.resolve(
              reportResponse,
            ),
            getCompany(
              reportResponse.company_id,
            ),
            getStatementOfFinancialPosition(
              reportId,
              appliedAsOf ||
                undefined,
            ),
          ]),
      )
      .then(
        ([
          reportResponse,
          companyResponse,
          statementResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          setReport(
            reportResponse,
          );

          setCompany(
            companyResponse,
          );

          setStatement(
            statementResponse,
          );

          setAsOfInput(
            statementResponse.as_of,
          );

          setResourceState(
            "ready",
          );
        },
      )
      .catch(
        (error: unknown) => {
          if (cancelled) {
            return;
          }

          setLoadError(
            getErrorMessage(
              error,
              "The Statement of Financial Position could not be calculated.",
            ),
          );

          setResourceState(
            "error",
          );
        },
      );

    return () => {
      cancelled = true;
    };
  }, [
    appliedAsOf,
    reloadVersion,
    reportId,
  ]);

  const sectionMap =
    useMemo(() => {
      return new Map<
        string,
        FinancialStatementSection
      >(
        statement?.sections.map(
          (section) => [
            section.key,
            section,
          ],
        ) ?? [],
      );
    }, [statement]);

  function handleAsOfSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (!asOfInput) {
      return;
    }

    setResourceState(
      "loading",
    );

    setLoadError(null);

    if (
      asOfInput ===
      appliedAsOf
    ) {
      setReloadVersion(
        (currentVersion) =>
          currentVersion + 1,
      );

      return;
    }

    setAppliedAsOf(
      asOfInput,
    );
  }

  function requestReload(): void {
    setResourceState(
      "loading",
    );

    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  return (
    <main className="financial-statement-page">
      <header className="app-topbar financial-statement-screen-only">
        <Link
          className="app-brand"
          href={`/reports/${reportId}`}
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              Statement of Financial Position
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports/${reportId}/statements/profit-or-loss`}
          >
            Profit or loss
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/trial-balance`}
          >
            Trial Balance
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}`}
          >
            Report overview
          </Link>
        </div>
      </header>

      <section className="financial-statement-toolbar financial-statement-screen-only">
        <form
          onSubmit={
            handleAsOfSubmit
          }
        >
          <label htmlFor="financial-position-date">
            Statement as at
          </label>

          <div>
            <input
              id="financial-position-date"
              required
              type="date"
              min={
                report?.period_start
              }
              max={
                report?.period_end
              }
              value={asOfInput}
              onChange={(event) =>
                setAsOfInput(
                  event.target.value,
                )
              }
            />

            <button type="submit">
              Recalculate
            </button>
          </div>
        </form>

        <div>
  <button
    className="text-button"
    type="button"
    disabled={
      resourceState ===
      "loading"
    }
    onClick={requestReload}
  >
    Refresh
  </button>

  <StatementPrintActions
    disabled={
      resourceState !==
      "ready"
    }
    documentTitle={`${
      company?.name?.trim() ||
      "Company"
    } — Statement of Financial Position`}
    suggestedFileName={`${
      company?.name?.trim() ||
      "Company"
    } - Statement of Financial Position - ${
      statement?.as_of ??
      report?.period_end ??
      "report"
    }.pdf`}
  />
</div>
      </section>

      <section
        className="financial-statement-content"
        aria-busy={
          resourceState ===
          "loading"
        }
      >
        {resourceState === "loading" ? (
          <div className="financial-statement-loading financial-statement-screen-only">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState === "error" ? (
          <div className="journal-state-card journal-state-card--error financial-statement-screen-only">
            <span>
              Calculation unavailable
            </span>

            <h2>
              Statement of Financial Position
              could not be calculated
            </h2>

            <p>{loadError}</p>

            <button
              className="primary-button"
              type="button"
              onClick={
                requestReload
              }
            >
              Try again
            </button>
          </div>
        ) : null}

        {resourceState === "ready" &&
        statement ? (
          <article className="financial-statement-document">
            <header className="financial-statement-document__header">
              <div>
                <p>
                  {company?.name?.trim() ||
  "Company"}
                </p>

                <h1>
                  Statement of Financial Position
                </h1>

                <span>
                  As at{" "}
                  {formatStatementDate(
                    statement.as_of,
                  )}
                </span>
              </div>

              <div className="financial-statement-document__currency">
                <span>
                  Currency
                </span>

                <strong>
                  {statement.currency}
                </strong>
              </div>
            </header>

            <div className="financial-statement-document__body">
              <div className="financial-position-column-heading">
                <span>Assets</span>
              </div>

              {sectionMap.get(
                "non_current_assets",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  section={
                    sectionMap.get(
                      "non_current_assets",
                    )!
                  }
                />
              ) : null}

              {sectionMap.get(
                "current_assets",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  section={
                    sectionMap.get(
                      "current_assets",
                    )!
                  }
                />
              ) : null}

              <div className="financial-statement-final-total">
                <div>
                  <span>
                    Assets
                  </span>

                  <strong>
                    Total Assets
                  </strong>
                </div>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.total_assets,
                  )}
                </strong>
              </div>

              <div className="financial-position-column-heading">
                <span>
                  Equity and Liabilities
                </span>
              </div>

              {sectionMap.get(
                "equity",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  section={
                    sectionMap.get(
                      "equity",
                    )!
                  }
                />
              ) : null}

              <div className="financial-statement-subtotal">
                <strong>
                  Total Equity
                </strong>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.total_equity,
                  )}
                </strong>
              </div>

              {sectionMap.get(
                "non_current_liabilities",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  section={
                    sectionMap.get(
                      "non_current_liabilities",
                    )!
                  }
                />
              ) : null}

              {sectionMap.get(
                "current_liabilities",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  section={
                    sectionMap.get(
                      "current_liabilities",
                    )!
                  }
                />
              ) : null}

              <div className="financial-statement-subtotal">
                <strong>
                  Total Liabilities
                </strong>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.total_liabilities,
                  )}
                </strong>
              </div>

              <div className="financial-statement-final-total">
                <div>
                  <span>
                    Equity and liabilities
                  </span>

                  <strong>
                    Total Equity and Liabilities
                  </strong>
                </div>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.total_liabilities_and_equity,
                  )}
                </strong>
              </div>

              <section
                className={
                  statement.is_balanced
                    ? "financial-position-validation financial-position-validation--balanced"
                    : "financial-position-validation financial-position-validation--error"
                }
              >
                <div>
                  <span>
                    Accounting equation
                  </span>

                  <strong>
                    {statement.is_balanced
                      ? "Assets equal equity and liabilities"
                      : "Statement is out of balance"}
                  </strong>

                  <p>
                    Difference:{" "}
                    {statement.currency}
                    {" "}
                    {formatStatementMoney(
                      statement.accounting_equation_difference,
                    )}
                  </p>
                </div>

                <span>
                  {statement.is_balanced
                    ? "Balanced"
                    : "Review required"}
                </span>
              </section>
            </div>

            <footer className="financial-statement-document__footer">
              <span>
                Current-year profit is included
                automatically within equity.
              </span>

              <span>
                Financial Statement Studio
              </span>
            </footer>
          </article>
        ) : null}
      </section>
    </main>
  );
}