"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import { EquityAccountTable } from "@/components/financial-statements/equity-account-table";
import { EquityMovementSection } from "@/components/financial-statements/equity-movement-section";
import { StatementPrintActions } from "@/components/financial-statements/statement-print-actions";
import {
  formatPeriod,
  formatStatementMoney,
  toNumber,
} from "@/components/financial-statements/statement-utils";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getStatementOfChangesInEquity,
} from "@/lib/equity-statements-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import type {
  Company,
} from "@/types/company";
import type {
  StatementOfChangesInEquity,
} from "@/types/equity-statement";
import type {
  FinancialReport,
} from "@/types/financial-report";

type EquityStatementWorkspaceProps = {
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

export function EquityStatementWorkspace({
  reportId,
}: EquityStatementWorkspaceProps) {
  const [report, setReport] =
    useState<FinancialReport | null>(
      null,
    );

  const [company, setCompany] =
    useState<Company | null>(
      null,
    );

  const [
    statement,
    setStatement,
  ] =
    useState<StatementOfChangesInEquity | null>(
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
        async (
          reportResponse,
        ) => {
          const [
            companyResponse,
            statementResponse,
          ] = await Promise.all([
            getCompany(
              reportResponse.company_id,
            ),

            getStatementOfChangesInEquity(
              reportId,
              appliedAsOf ||
                undefined,
            ),
          ]);

          return {
            reportResponse,
            companyResponse,
            statementResponse,
          };
        },
      )
      .then(
        ({
          reportResponse,
          companyResponse,
          statementResponse,
        }) => {
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
              "The Statement of Changes in Equity could not be loaded.",
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

  const profitIsPositive =
    toNumber(
      statement?.profit_after_tax ??
        0,
    ) >= 0;

  const totalEquityIsPositive =
    toNumber(
      statement?.total_closing_equity ??
        0,
    ) >= 0;

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
              Changes in Equity
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
            href={`/reports/${reportId}/statements/financial-position`}
          >
            Financial position
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/statements/cash-flows`}
          >
            Cash flows
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
          <label htmlFor="equity-statement-date">
            Calculate up to
          </label>

          <div>
            <input
              id="equity-statement-date"
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

            <button
              type="submit"
            >
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
            onClick={
              requestReload
            }
          >
            Refresh
          </button>

          <StatementPrintActions
            disabled={
              resourceState !==
                "ready" ||
              !statement
            }
            documentTitle={`${
              company?.name?.trim() ||
              "Company"
            } — Statement of Changes in Equity`}
            suggestedFileName={`${
              company?.name?.trim() ||
              "Company"
            } - Statement of Changes in Equity - ${
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
        {resourceState ===
        "loading" ? (
          <div className="financial-statement-loading financial-statement-screen-only">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState ===
        "error" ? (
          <div className="journal-state-card journal-state-card--error financial-statement-screen-only">
            <span>
              Calculation unavailable
            </span>

            <h2>
              Statement of Changes in
              Equity could not be loaded
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

        {resourceState ===
          "ready" &&
        statement ? (
          <article className="financial-statement-document equity-statement-document">
            <header className="financial-statement-document__header">
              <div>
                <p>
                  {company?.name?.trim() ||
                    "Company"}
                </p>

                <h1>
                  Statement of Changes in
                  Equity
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
              <div className="financial-position-column-heading">
                <span>
                  Movement in Recorded Equity
                </span>
              </div>

              <div className="equity-opening-line">
                <strong>
                  Opening Recorded Equity
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .opening_recorded_equity,
                  )}
                </strong>
              </div>

              <EquityMovementSection
                currency={
                  statement.currency
                }
                section={
                  statement
                    .direct_increases
                }
              />

              <EquityMovementSection
                currency={
                  statement.currency
                }
                section={
                  statement
                    .direct_decreases
                }
              />

              <div className="financial-statement-subtotal">
                <strong>
                  Net Direct Movement in
                  Equity
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .net_direct_equity_movement,
                  )}
                </strong>
              </div>

              <div className="financial-statement-subtotal financial-statement-subtotal--major">
                <strong>
                  Recorded Closing Equity
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .recorded_closing_equity,
                  )}
                </strong>
              </div>

              <div
                className={
                  profitIsPositive
                    ? "equity-profit-line equity-profit-line--positive"
                    : "equity-profit-line equity-profit-line--negative"
                }
              >
                <div>
                  <span>
                    Financial performance
                  </span>

                  <strong>
                    {profitIsPositive
                      ? "Profit After Tax"
                      : "Loss After Tax"}
                  </strong>
                </div>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .profit_after_tax,
                  )}
                </strong>
              </div>

              <div
                className={
                  totalEquityIsPositive
                    ? "financial-statement-final-total financial-statement-final-total--positive"
                    : "financial-statement-final-total financial-statement-final-total--negative"
                }
              >
                <div>
                  <span>
                    Closing position
                  </span>

                  <strong>
                    Total Closing Equity
                  </strong>
                </div>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .total_closing_equity,
                  )}
                </strong>
              </div>

              <EquityAccountTable
                statement={
                  statement
                }
              />

              <section
                className={
                  statement.is_reconciled
                    ? "financial-position-validation financial-position-validation--balanced"
                    : "financial-position-validation financial-position-validation--error"
                }
              >
                <div>
                  <span>
                    Equity reconciliation
                  </span>

                  <strong>
                    {statement.is_reconciled
                      ? "Recorded equity movements reconcile"
                      : "Equity movements require review"}
                  </strong>

                  <p>
                    Difference:{" "}
                    {statement.currency}
                    {" "}
                    {formatStatementMoney(
                      statement
                        .equity_reconciliation_difference,
                    )}
                  </p>
                </div>

                <span>
                  {statement.is_reconciled
                    ? "Reconciled"
                    : "Review required"}
                </span>
              </section>

              <section className="equity-reconciliation-detail">
                <div>
                  <span>
                    Calculated recorded closing
                    equity
                  </span>

                  <strong>
                    {statement.currency}
                    {" "}
                    {formatStatementMoney(
                      statement
                        .calculated_recorded_closing_equity,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Actual recorded closing
                    equity
                  </span>

                  <strong>
                    {statement.currency}
                    {" "}
                    {formatStatementMoney(
                      statement
                        .recorded_closing_equity,
                    )}
                  </strong>
                </div>
              </section>
            </div>

            <footer className="financial-statement-document__footer">
              <span>
                Prepared from posted,
                non-voided journal entries.
                Current-year profit is shown
                separately from recorded equity.
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