"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  getTrialBalance,
} from "@/lib/journal-api";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import type {
  MoneyValue,
  TrialBalance,
  TrialBalanceLine,
} from "@/types/journal-entry";

type TrialBalanceWorkspaceProps = {
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

function formatMoney(
  value: MoneyValue,
): string {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return String(value);
  }

  return new Intl.NumberFormat(
    "en-GH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(numericValue);
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

export function TrialBalanceWorkspace({
  reportId,
}: TrialBalanceWorkspaceProps) {
  const [report, setReport] =
    useState<FinancialReport | null>(
      null,
    );

  const [company, setCompany] =
    useState<Company | null>(null);

  const [
    trialBalance,
    setTrialBalance,
  ] = useState<TrialBalance | null>(
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

  const [reloadVersion, setReloadVersion] =
    useState(0);

  const [resourceState, setResourceState] =
    useState<ResourceState>("loading");

  const [loadError, setLoadError] =
    useState<string | null>(null);

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
            getTrialBalance(
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
          balanceResponse,
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

          setTrialBalance(
            balanceResponse,
          );

          setAsOfInput(
            balanceResponse.as_of,
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
            "The Trial Balance could not be calculated.",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    appliedAsOf,
    reloadVersion,
    reportId,
  ]);

  const groupedItems =
    useMemo(() => {
      if (!trialBalance) {
        return [];
      }

      const groups =
        new Map<
          string,
          TrialBalanceLine[]
        >();

      for (
        const item
        of trialBalance.items
      ) {
        const currentGroup =
          groups.get(
            item.account_type,
          ) ?? [];

        currentGroup.push(item);

        groups.set(
          item.account_type,
          currentGroup,
        );
      }

      const preferredOrder = [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
      ];

      return preferredOrder
        .map((accountType) => ({
          accountType,
          items:
            groups.get(
              accountType,
            ) ?? [],
        }))
        .filter(
          (group) =>
            group.items.length > 0,
        );
    }, [trialBalance]);

  function handleAsOfSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (!asOfInput) {
      return;
    }

    setResourceState("loading");
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

    setAppliedAsOf(asOfInput);
  }

  function requestReload(): void {
    setResourceState("loading");
    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  return (
    <main className="trial-balance-page">
      <header className="app-topbar">
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
              Trial Balance
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports/${reportId}/journal`}
          >
            General journal
          </Link>

          {report ? (
            <Link
              className="topbar-link"
              href={`/companies/${report.company_id}/chart-of-accounts`}
            >
              Chart of accounts
            </Link>
          ) : null}

          <Link
            className="topbar-link"
            href={`/reports/${reportId}`}
          >
            Report overview
          </Link>
        </div>
      </header>

      <section className="trial-balance-hero">
        <div>
          <p className="eyebrow">
            Trial Balance
          </p>

          <h1>
            {report?.title ??
              "Financial report"}
          </h1>

          <p>
            The Trial Balance summarises
            balances from posted journal
            entries up to the selected date.
          </p>
        </div>

        <div className="trial-balance-hero__summary">
          <span>
            Balance status
          </span>

          <strong>
            {resourceState === "ready" &&
            trialBalance
              ? trialBalance.is_balanced
                ? "Balanced"
                : "Out of balance"
              : "Checking"}
          </strong>

          <p>
            {trialBalance
              ? `${trialBalance.posted_entry_count} posted ${
                  trialBalance.posted_entry_count ===
                  1
                    ? "entry"
                    : "entries"
                }`
              : "Loading posted entries"}
          </p>
        </div>
      </section>

      <section className="trial-balance-toolbar">
        <form
          onSubmit={
            handleAsOfSubmit
          }
        >
          <label htmlFor="trial-balance-date">
            Trial Balance as at
          </label>

          <div>
            <input
              id="trial-balance-date"
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
          <p>
            Currency:{" "}
            <strong>
              {report?.currency ??
                "—"}
            </strong>
          </p>

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
        </div>
      </section>

      <section
        className="trial-balance-content"
        aria-busy={
          resourceState ===
          "loading"
        }
      >
        {resourceState === "loading" ? (
          <div className="trial-balance-loading">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState === "error" ? (
          <div className="journal-state-card journal-state-card--error">
            <span>
              Calculation unavailable
            </span>

            <h2>
              The Trial Balance could not
              be calculated
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
        trialBalance &&
        trialBalance.items.length ===
          0 ? (
          <div className="journal-state-card">
            <span>
              No posted balances
            </span>

            <h2>
              Post a journal entry to
              generate the Trial Balance
            </h2>

            <p>
              Draft and voided entries are
              intentionally excluded from the
              Trial Balance.
            </p>

            <Link
              className="primary-button"
              href={`/reports/${reportId}/journal`}
            >
              Open general journal
            </Link>
          </div>
        ) : null}

        {resourceState === "ready" &&
        trialBalance &&
        trialBalance.items.length >
          0 ? (
          <>
            <div className="trial-balance-heading">
              <div>
                <p className="eyebrow">
                  {company?.name ??
                    "Company"}
                </p>

                <h2>
                  Trial Balance as at{" "}
                  {formatDate(
                    trialBalance.as_of,
                  )}
                </h2>
              </div>

              <span
                className={
                  trialBalance.is_balanced
                    ? "trial-balance-badge trial-balance-badge--balanced"
                    : "trial-balance-badge trial-balance-badge--error"
                }
              >
                {trialBalance.is_balanced
                  ? "Debits equal credits"
                  : "Debits do not equal credits"}
              </span>
            </div>

            <div className="trial-balance-table-wrapper">
              <table className="trial-balance-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th>
                      Statement category
                    </th>
                    <th>
                      Movement debit
                    </th>
                    <th>
                      Movement credit
                    </th>
                    <th>
                      Debit balance
                    </th>
                    <th>
                      Credit balance
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {groupedItems.flatMap(
                    (group) => [
                      <tr
                        className="trial-balance-group-row"
                        key={`group-${group.accountType}`}
                      >
                        <th
                          colSpan={7}
                        >
                          {group.accountType}
                        </th>
                      </tr>,

                      ...group.items.map(
                        (item) => (
                          <tr
                            key={
                              item.ledger_account_id
                            }
                          >
                            <td>
                              {
                                item.account_code
                              }
                            </td>

                            <td>
                              {
                                item.account_name
                              }
                            </td>

                            <td>
                              {
                                item.report_category
                              }
                            </td>

                            <td>
                              {Number(
                                item.movement_debit,
                              ) > 0
                                ? formatMoney(
                                    item.movement_debit,
                                  )
                                : "—"}
                            </td>

                            <td>
                              {Number(
                                item.movement_credit,
                              ) > 0
                                ? formatMoney(
                                    item.movement_credit,
                                  )
                                : "—"}
                            </td>

                            <td>
                              {Number(
                                item.debit_balance,
                              ) > 0
                                ? formatMoney(
                                    item.debit_balance,
                                  )
                                : "—"}
                            </td>

                            <td>
                              {Number(
                                item.credit_balance,
                              ) > 0
                                ? formatMoney(
                                    item.credit_balance,
                                  )
                                : "—"}
                            </td>
                          </tr>
                        ),
                      ),
                    ],
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <th colSpan={5}>
                      Trial Balance totals
                    </th>

                    <th>
                      {report?.currency}
                      {" "}
                      {formatMoney(
                        trialBalance.total_debit,
                      )}
                    </th>

                    <th>
                      {report?.currency}
                      {" "}
                      {formatMoney(
                        trialBalance.total_credit,
                      )}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <footer className="company-page__footer">
        <span>
          {company?.name ??
            "Financial Statement Studio"}
        </span>

        <span>
          Generated from posted,
          non-voided journal entries.
        </span>
      </footer>
    </main>
  );
}