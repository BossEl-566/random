"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CashFlowSection } from "@/components/financial-statements/cash-flow-section";
import { StatementPrintActions } from "@/components/financial-statements/statement-print-actions";
import {
  formatPeriod,
  formatStatementMoney,
  toNumber,
} from "@/components/financial-statements/statement-utils";
import {
  getCashFlowReadiness,
  getStatementOfCashFlows,
} from "@/lib/cash-flow-api";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  listLedgerAccounts,
  updateLedgerAccount,
} from "@/lib/ledger-accounts-api";
import type {
  CashFlowReadiness,
  CashFlowStatementSection,
  StatementOfCashFlows,
} from "@/types/cash-flow";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import type {
  LedgerAccount,
} from "@/types/ledger-account";

type CashFlowWorkspaceProps = {
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

export function CashFlowWorkspace({
  reportId,
}: CashFlowWorkspaceProps) {
  const [report, setReport] =
    useState<FinancialReport | null>(
      null,
    );

  const [company, setCompany] =
    useState<Company | null>(
      null,
    );

  const [accounts, setAccounts] =
    useState<LedgerAccount[]>([]);

  const [
    readiness,
    setReadiness,
  ] = useState<CashFlowReadiness | null>(
    null,
  );

  const [
    statement,
    setStatement,
  ] = useState<StatementOfCashFlows | null>(
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

  const [
    selectedCashAccountId,
    setSelectedCashAccountId,
  ] = useState("");

  const [
    isMarkingCashAccount,
    setIsMarkingCashAccount,
  ] = useState(false);

  const [
    setupError,
    setSetupError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    getFinancialReport(reportId)
      .then(
        async (
          reportResponse,
        ) => {
          const [
            companyResponse,
            accountResponse,
            readinessResponse,
          ] = await Promise.all([
            getCompany(
              reportResponse.company_id,
            ),

            listLedgerAccounts(
              reportResponse.company_id,
              {
                includeInactive: true,
                offset: 0,
                limit: 500,
              },
            ),

            getCashFlowReadiness(
              reportId,
            ),
          ]);

          const statementResponse =
            readinessResponse.is_ready
              ? await getStatementOfCashFlows(
                  reportId,
                  appliedAsOf ||
                    undefined,
                )
              : null;

          return {
            reportResponse,
            companyResponse,
            accountResponse,
            readinessResponse,
            statementResponse,
          };
        },
      )
      .then(
        ({
          reportResponse,
          companyResponse,
          accountResponse,
          readinessResponse,
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

          setAccounts(
            accountResponse.items,
          );

          setReadiness(
            readinessResponse,
          );

          setStatement(
            statementResponse,
          );

          setAsOfInput(
            statementResponse
              ?.period_end ??
              reportResponse.period_end,
          );

          const cashCandidates =
            accountResponse.items.filter(
              (account) =>
                account.is_active &&
                !account
                  .is_cash_equivalent &&
                account
                  .report_category ===
                  "current_assets",
            );

          setSelectedCashAccountId(
            (currentAccountId) => {
              const currentStillExists =
                cashCandidates.some(
                  (account) =>
                    account.id ===
                    currentAccountId,
                );

              if (currentStillExists) {
                return currentAccountId;
              }

              return (
                cashCandidates[0]?.id ??
                ""
              );
            },
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
              "The Statement of Cash Flows could not be loaded.",
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

  const cashCandidates =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.is_active &&
            !account
              .is_cash_equivalent &&
            account
              .report_category ===
              "current_assets",
        ),
      [accounts],
    );

  const hasMissingCashWarning =
    readiness?.warnings.some(
      (warning) =>
        warning.code ===
        "NO_ACTIVE_CASH_ACCOUNT",
    ) ?? false;

  function handleAsOfSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (
      !asOfInput ||
      !readiness?.is_ready
    ) {
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
    setSetupError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  async function handleMarkCashAccount(): Promise<void> {
    if (!selectedCashAccountId) {
      setSetupError(
        "Select a current asset account to mark as cash or cash equivalent.",
      );
      return;
    }

    setIsMarkingCashAccount(true);
    setSetupError(null);

    try {
      await updateLedgerAccount(
        selectedCashAccountId,
        {
          is_cash_equivalent: true,
          cash_flow_category:
            "not_applicable",
        },
      );

      requestReload();
    } catch (error) {
      setSetupError(
        getErrorMessage(
          error,
          "The selected account could not be marked as cash.",
        ),
      );
    } finally {
      setIsMarkingCashAccount(
        false,
      );
    }
  }

  const closingCashSection:
    CashFlowStatementSection | null =
    statement
      ? {
          key: "cash_accounts",
          title:
            "Cash and Cash Equivalents at Period End",
          items:
            statement.cash_accounts,
          total:
            statement.closing_cash_balance,
        }
      : null;

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
              Statement of Cash Flows
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
          <Link
  className="topbar-link"
  href={`/reports/${reportId}/statements/changes-in-equity`}
>
  Changes in equity
</Link>
        </div>
      </header>

      <section className="financial-statement-toolbar financial-statement-screen-only">
        <form
          onSubmit={
            handleAsOfSubmit
          }
        >
          <label htmlFor="cash-flow-date">
            Calculate up to
          </label>

          <div>
            <input
              id="cash-flow-date"
              required
              type="date"
              min={
                report?.period_start
              }
              max={
                report?.period_end
              }
              disabled={
                !readiness?.is_ready
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
              disabled={
                !readiness?.is_ready
              }
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
            onClick={requestReload}
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
            } — Statement of Cash Flows`}
            suggestedFileName={`${
              company?.name?.trim() ||
              "Company"
            } - Statement of Cash Flows - ${
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
              Statement of Cash Flows
              could not be loaded
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
        readiness &&
        !readiness.is_ready ? (
          <section className="cash-flow-readiness-card financial-statement-screen-only">
            <header>
              <div>
                <p className="eyebrow">
                  Cash-flow setup
                </p>

                <h1>
                  Complete the Chart of Accounts
                </h1>

                <p>
                  The Statement of Cash Flows
                  cannot be calculated until
                  cash accounts and cash-flow
                  categories are configured.
                </p>
              </div>

              <span>
                {readiness.warnings.length}
                {" "}
                {readiness.warnings.length ===
                1
                  ? "warning"
                  : "warnings"}
              </span>
            </header>

            {setupError ? (
              <div
                className="form-alert form-alert--error"
                role="alert"
              >
                {setupError}
              </div>
            ) : null}

            {hasMissingCashWarning &&
            cashCandidates.length > 0 ? (
              <section className="cash-flow-quick-setup">
                <div>
                  <h2>
                    Select the main cash account
                  </h2>

                  <p>
                    Choose a bank, cash-on-hand,
                    petty-cash or mobile-money
                    account. It will be marked as
                    cash or cash equivalent.
                  </p>
                </div>

                <div>
                  <select
                    value={
                      selectedCashAccountId
                    }
                    onChange={(event) =>
                      setSelectedCashAccountId(
                        event.target.value,
                      )
                    }
                  >
                    {cashCandidates.map(
                      (account) => (
                        <option
                          value={account.id}
                          key={account.id}
                        >
                          {account.account_code}
                          {" — "}
                          {account.account_name}
                        </option>
                      ),
                    )}
                  </select>

                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      isMarkingCashAccount ||
                      !selectedCashAccountId
                    }
                    onClick={() => {
                      void handleMarkCashAccount();
                    }}
                  >
                    {isMarkingCashAccount
                      ? "Updating account..."
                      : "Mark as cash account"}
                  </button>
                </div>
              </section>
            ) : null}

            <div className="cash-flow-warning-list">
              {readiness.warnings.map(
                (warning) => (
                  <article
                    key={[
                      warning.code,
                      warning.ledger_account_id ??
                        "general",
                    ].join("-")}
                  >
                    <span>
                      {warning.code
                        .replaceAll(
                          "_",
                          " ",
                        )
                        .toLowerCase()}
                    </span>

                    <p>
                      {warning.message}
                    </p>
                  </article>
                ),
              )}
            </div>

            <footer>
              {report ? (
                <Link
                  className="primary-button"
                  href={`/companies/${report.company_id}/chart-of-accounts`}
                >
                  Open Chart of Accounts
                </Link>
              ) : null}

              <button
                className="secondary-button"
                type="button"
                onClick={requestReload}
              >
                Check readiness again
              </button>
            </footer>
          </section>
        ) : null}

        {resourceState === "ready" &&
        readiness?.is_ready &&
        statement ? (
          <article className="financial-statement-document">
            <header className="financial-statement-document__header">
              <div>
                <p>
                  {company?.name?.trim() ||
                    "Company"}
                </p>

                <h1>
                  Statement of Cash Flows
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
                  Cash Flows from Operating Activities
                </span>
              </div>

              <div className="cash-flow-starting-line">
                <strong>
                  Profit After Tax
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement.profit_after_tax,
                  )}
                </strong>
              </div>

              <CashFlowSection
                currency={
                  statement.currency
                }
                section={
                  statement
                    .non_cash_adjustments
                }
              />

              <CashFlowSection
                currency={
                  statement.currency
                }
                section={
                  statement
                    .working_capital_adjustments
                }
              />

              <div className="financial-statement-subtotal financial-statement-subtotal--major">
                <strong>
                  Net Cash from Operating Activities
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .net_cash_from_operating_activities,
                  )}
                </strong>
              </div>

              <div className="financial-position-column-heading">
                <span>
                  Cash Flows from Investing Activities
                </span>
              </div>

              <CashFlowSection
                currency={
                  statement.currency
                }
                section={
                  statement
                    .investing_activities
                }
              />

              <div className="financial-statement-subtotal">
                <strong>
                  Net Cash from Investing Activities
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .net_cash_from_investing_activities,
                  )}
                </strong>
              </div>

              <div className="financial-position-column-heading">
                <span>
                  Cash Flows from Financing Activities
                </span>
              </div>

              <CashFlowSection
                currency={
                  statement.currency
                }
                section={
                  statement
                    .financing_activities
                }
              />

              <div className="financial-statement-subtotal">
                <strong>
                  Net Cash from Financing Activities
                </strong>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .net_cash_from_financing_activities,
                  )}
                </strong>
              </div>

              <div
                className={
                  toNumber(
                    statement
                      .net_increase_decrease_in_cash,
                  ) >= 0
                    ? "financial-statement-final-total financial-statement-final-total--positive"
                    : "financial-statement-final-total financial-statement-final-total--negative"
                }
              >
                <div>
                  <span>
                    Net cash movement
                  </span>

                  <strong>
                    {toNumber(
                      statement
                        .net_increase_decrease_in_cash,
                    ) >= 0
                      ? "Net Increase in Cash"
                      : "Net Decrease in Cash"}
                  </strong>
                </div>

                <strong>
                  <span>
                    {statement.currency}
                  </span>

                  {formatStatementMoney(
                    statement
                      .net_increase_decrease_in_cash,
                  )}
                </strong>
              </div>

              <section className="cash-flow-reconciliation">
                <header>
                  <h3>
                    Cash Reconciliation
                  </h3>
                </header>

                <div className="cash-flow-reconciliation__lines">
                  <div>
                    <span>
                      Opening cash and cash equivalents
                    </span>

                    <strong>
                      {statement.currency}
                      {" "}
                      {formatStatementMoney(
                        statement
                          .opening_cash_balance,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Net increase or decrease in cash
                    </span>

                    <strong>
                      {statement.currency}
                      {" "}
                      {formatStatementMoney(
                        statement
                          .net_increase_decrease_in_cash,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Calculated closing cash
                    </span>

                    <strong>
                      {statement.currency}
                      {" "}
                      {formatStatementMoney(
                        statement
                          .calculated_closing_cash,
                      )}
                    </strong>
                  </div>

                  <div className="cash-flow-reconciliation__closing">
                    <span>
                      Actual closing cash and cash equivalents
                    </span>

                    <strong>
                      {statement.currency}
                      {" "}
                      {formatStatementMoney(
                        statement
                          .closing_cash_balance,
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              {closingCashSection ? (
                <CashFlowSection
                  currency={
                    statement.currency
                  }
                  section={
                    closingCashSection
                  }
                />
              ) : null}

              <section
                className={
                  statement.is_reconciled
                    ? "financial-position-validation financial-position-validation--balanced"
                    : "financial-position-validation financial-position-validation--error"
                }
              >
                <div>
                  <span>
                    Cash reconciliation
                  </span>

                  <strong>
                    {statement.is_reconciled
                      ? "Calculated cash agrees with the ledger"
                      : "Cash balance does not reconcile"}
                  </strong>

                  <p>
                    Difference:{" "}
                    {statement.currency}
                    {" "}
                    {formatStatementMoney(
                      statement
                        .cash_reconciliation_difference,
                    )}
                  </p>
                </div>

                <span>
                  {statement.is_reconciled
                    ? "Reconciled"
                    : "Review required"}
                </span>
              </section>
            </div>

            <footer className="financial-statement-document__footer">
              <span>
                Prepared using the indirect
                method from posted, non-voided
                journal entries.
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