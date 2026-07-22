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
  formatPeriod,
  formatStatementMoney,
  toNumber,
} from "@/components/financial-statements/statement-utils";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  getProfitOrLossStatement,
} from "@/lib/financial-statements-api";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import type {
  FinancialStatementSection,
  ProfitOrLossStatement,
} from "@/types/financial-statement";
import { StatementPrintActions } from "@/components/financial-statements/statement-print-actions";

type ProfitOrLossWorkspaceProps = {
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

export function ProfitOrLossWorkspace({
  reportId,
}: ProfitOrLossWorkspaceProps) {
  const [report, setReport] =
    useState<FinancialReport | null>(
      null,
    );

  const [company, setCompany] =
    useState<Company | null>(null);

  const [
    statement,
    setStatement,
  ] = useState<ProfitOrLossStatement | null>(
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
            getProfitOrLossStatement(
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
            statementResponse.period_end,
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
              "The Statement of Profit or Loss could not be calculated.",
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

  const directCostSections = [
    sectionMap.get(
      "cost_of_sales",
    ),
    sectionMap.get(
      "direct_service_costs",
    ),
    sectionMap.get(
      "manufacturing_costs",
    ),
  ].filter(
    (
      section,
    ): section is FinancialStatementSection =>
      section !== undefined,
  );

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
              Statement of Profit or Loss
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports/${reportId}/statements/financial-position`}
          >
            Financial position
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
          <label htmlFor="profit-or-loss-date">
            Calculate up to
          </label>

          <div>
            <input
              id="profit-or-loss-date"
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
    } — Statement of Profit or Loss`}
    suggestedFileName={`${
      company?.name?.trim() ||
      "Company"
    } - Statement of Profit or Loss - ${
      statement?.period_end ??
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
              Statement of Profit or Loss
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
                  Statement of Profit or Loss
                </h1>

                <span>
                  {formatPeriod(
                    statement.period_start,
                    statement.period_end,
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
              {sectionMap.get(
                "revenue",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  section={
                    sectionMap.get(
                      "revenue",
                    )!
                  }
                />
              ) : null}

              {directCostSections.map(
                (section) => (
                  <StatementSection
                    currency={
                      statement.currency
                    }
                    hideWhenEmpty
                    section={
                      section
                    }
                    key={
                      section.key
                    }
                  />
                ),
              )}

              <div className="financial-statement-subtotal financial-statement-subtotal--major">
                <strong>
                  Gross Profit
                </strong>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.gross_profit,
                  )}
                </strong>
              </div>

              {sectionMap.get(
                "other_income",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  hideWhenEmpty
                  section={
                    sectionMap.get(
                      "other_income",
                    )!
                  }
                />
              ) : null}

              {sectionMap.get(
                "administrative_expenses",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  hideWhenEmpty
                  section={
                    sectionMap.get(
                      "administrative_expenses",
                    )!
                  }
                />
              ) : null}

              {sectionMap.get(
                "selling_distribution_expenses",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  hideWhenEmpty
                  section={
                    sectionMap.get(
                      "selling_distribution_expenses",
                    )!
                  }
                />
              ) : null}

              <div className="financial-statement-subtotal">
                <strong>
                  Operating Profit
                </strong>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.operating_profit,
                  )}
                </strong>
              </div>

              {sectionMap.get(
                "finance_costs",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  hideWhenEmpty
                  section={
                    sectionMap.get(
                      "finance_costs",
                    )!
                  }
                />
              ) : null}

              <div className="financial-statement-subtotal">
                <strong>
                  Profit Before Tax
                </strong>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.profit_before_tax,
                  )}
                </strong>
              </div>

              {sectionMap.get(
                "taxation",
              ) ? (
                <StatementSection
                  currency={
                    statement.currency
                  }
                  hideWhenEmpty
                  section={
                    sectionMap.get(
                      "taxation",
                    )!
                  }
                />
              ) : null}

              <div
                className={
                  toNumber(
                    statement.profit_after_tax,
                  ) >= 0
                    ? "financial-statement-final-total financial-statement-final-total--positive"
                    : "financial-statement-final-total financial-statement-final-total--negative"
                }
              >
                <div>
                  <span>
                    Result for the period
                  </span>

                  <strong>
                    {toNumber(
                      statement.profit_after_tax,
                    ) >= 0
                      ? "Profit After Tax"
                      : "Loss After Tax"}
                  </strong>
                </div>

                <strong>
                  <span>
                    {
                      statement.currency
                    }
                  </span>

                  {formatStatementMoney(
                    statement.profit_after_tax,
                  )}
                </strong>
              </div>
            </div>

            <footer className="financial-statement-document__footer">
              <span>
                Generated from posted,
                non-voided journal entries.
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