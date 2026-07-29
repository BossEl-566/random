"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { PostTaxAdjustmentDialog } from "@/components/tax/post-tax-adjustment-dialog";
import {
  listLedgerAccounts,
} from "@/lib/ledger-accounts-api";
import {
  getTaxReconciliation,
  postTaxAdjustment,
} from "@/lib/tax-configuration-api";
import type {
  JournalEntry,
} from "@/types/journal-entry";
import type {
  LedgerAccount,
} from "@/types/ledger-account";
import type {
  PostTaxAdjustmentPayload,
  TaxDecimal,
  TaxReconciliation,
  TaxReconciliationStatus,
} from "@/types/tax-configuration";

type TaxReconciliationWorkspaceProps = {
  reportId: string;
  companyId: string;

  reportCurrency: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  reportStatus: string;
};

type ResourceState =
  | "loading"
  | "ready"
  | "error";

type StatusMessage = {
  type:
    | "success"
    | "error"
    | "info";

  text: string;
} | null;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

function formatMoney(
  value: TaxDecimal,
  currency: string,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${String(
      value,
    )}`;
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(
      2,
    )}`;
  }
}

function formatDate(
  value: string,
): string {
  const date = new Date(
    `${value}T00:00:00`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

function formatStatus(
  status: TaxReconciliationStatus,
): string {
  return status
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function findPreferredAccount(
  accounts: LedgerAccount[],
  preferredName: string,
): string {
  return (
    accounts.find(
      (account) =>
        account.account_name
          .trim()
          .toLowerCase() ===
        preferredName.toLowerCase(),
    )?.id ??
    accounts[0]?.id ??
    ""
  );
}

export function TaxReconciliationWorkspace({
  reportId,
  companyId,
  reportCurrency,
  reportPeriodStart,
  reportPeriodEnd,
  reportStatus,
}: TaxReconciliationWorkspaceProps) {
  const [
    reconciliation,
    setReconciliation,
  ] =
    useState<TaxReconciliation | null>(
      null,
    );

  const [
    accounts,
    setAccounts,
  ] = useState<LedgerAccount[]>(
    [],
  );

  const [
    expenseAccountId,
    setExpenseAccountId,
  ] = useState("");

  const [
    payableAccountId,
    setPayableAccountId,
  ] = useState("");

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
    statusMessage,
    setStatusMessage,
  ] = useState<StatusMessage>(
    null,
  );

  const [
    showPostingDialog,
    setShowPostingDialog,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    lastPostedJournal,
    setLastPostedJournal,
  ] = useState<JournalEntry | null>(
    null,
  );

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  const reportIsLocked = [
    "finalised",
    "printed",
    "archived",
  ].includes(reportStatus);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getTaxReconciliation(
        reportId,
      ),

      listLedgerAccounts(
        companyId,
        {
          includeInactive: false,
          offset: 0,
          limit: 500,
        },
      ),
    ])
      .then(
        ([
          reconciliationResponse,
          accountResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          const activeAccounts =
            accountResponse.items.filter(
              (account) =>
                account.is_active,
            );

          const expenseAccounts =
            activeAccounts.filter(
              (account) =>
                account.account_type ===
                  "expense" &&
                account.report_category ===
                  "taxation",
            );

          const payableAccounts =
            activeAccounts.filter(
              (account) =>
                account.account_type ===
                  "liability" &&
                account.report_category ===
                  "current_liabilities",
            );

          setReconciliation(
            reconciliationResponse,
          );

          setAccounts(
            activeAccounts,
          );

          setExpenseAccountId(
            (currentAccountId) =>
              currentAccountId &&
              expenseAccounts.some(
                (account) =>
                  account.id ===
                  currentAccountId,
              )
                ? currentAccountId
                : findPreferredAccount(
                    expenseAccounts,
                    "Income Tax Expense",
                  ),
          );

          setPayableAccountId(
            (currentAccountId) =>
              currentAccountId &&
              payableAccounts.some(
                (account) =>
                  account.id ===
                  currentAccountId,
              )
                ? currentAccountId
                : findPreferredAccount(
                    payableAccounts,
                    "Tax Payable",
                  ),
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
              "Tax reconciliation could not be loaded.",
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
    companyId,
    reloadVersion,
    reportId,
  ]);

  const expenseAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.account_type ===
              "expense" &&
            account.report_category ===
              "taxation" &&
            account.is_active,
        ),
      [accounts],
    );

  const payableAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.account_type ===
              "liability" &&
            account.report_category ===
              "current_liabilities" &&
            account.is_active,
        ),
      [accounts],
    );

  const selectedExpenseAccount =
    expenseAccounts.find(
      (account) =>
        account.id ===
        expenseAccountId,
    ) ?? null;

  const selectedPayableAccount =
    payableAccounts.find(
      (account) =>
        account.id ===
        payableAccountId,
    ) ?? null;

  const draftCalculationCount =
    reconciliation?.calculations.filter(
      (calculation) =>
        calculation.status ===
        "draft",
    ).length ?? 0;

  const confirmedCalculationCount =
    reconciliation?.calculations.filter(
      (calculation) =>
        calculation.status ===
        "confirmed",
    ).length ?? 0;

  const reconciliationDifference =
    Number(
      reconciliation?.difference ??
        0,
    );

  const canPostAdjustment =
    Boolean(
      reconciliation &&
      reconciliation.status ===
        "under_posted" &&
      Number.isFinite(
        reconciliationDifference,
      ) &&
      reconciliationDifference > 0 &&
      expenseAccounts.length > 0 &&
      payableAccounts.length > 0 &&
      !reportIsLocked,
    );

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

  async function handlePostAdjustment(
    payload: PostTaxAdjustmentPayload,
  ): Promise<void> {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response =
        await postTaxAdjustment(
          reportId,
          payload,
        );

      setReconciliation(
        response.reconciliation,
      );

      setLastPostedJournal(
        response.journal_entry,
      );

      setShowPostingDialog(false);

      setStatusMessage({
        type: "success",
        text:
          `${response.journal_entry.entry_number} was posted successfully. The tax reconciliation is now ${formatStatus(
            response.reconciliation
              .status,
          ).toLowerCase()}.`,
      });

      window.dispatchEvent(
        new Event(
          "tax-calculations-updated",
        ),
      );
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The tax adjustment could not be posted.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="version-history-panel">
      <header>
        <div>
          <span>
            Ledger tax control
          </span>

          <h2>
            Tax Reconciliation
          </h2>

          <p>
            Compare configured tax
            calculations with taxation
            already posted to the general
            ledger.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          disabled={
            resourceState ===
            "loading"
          }
          onClick={requestReload}
        >
          Refresh reconciliation
        </button>
      </header>

      {statusMessage ? (
        <div
          className={`notes-status notes-status--${statusMessage.type}`}
          role={
            statusMessage.type ===
            "error"
              ? "alert"
              : "status"
          }
        >
          {statusMessage.text}
        </div>
      ) : null}

      {resourceState ===
      "loading" ? (
        <div className="financial-statement-loading">
          <div />
          <div />
          <div />
          <div />
        </div>
      ) : null}

      {resourceState ===
      "error" ? (
        <div className="journal-state-card journal-state-card--error">
          <span>
            Reconciliation unavailable
          </span>

          <h2>
            Tax reconciliation could
            not be calculated
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

      {resourceState ===
        "ready" &&
      reconciliation ? (
        <>
          <section className="finalisation-readiness-panel">
            <header>
              <div>
                <span>
                  Reconciliation status
                </span>

                <h2>
                  {formatStatus(
                    reconciliation.status,
                  )}
                </h2>
              </div>

              <strong
                className={
                  reconciliation.status ===
                  "reconciled"
                    ? "readiness-badge readiness-badge--ready"
                    : "readiness-badge readiness-badge--blocked"
                }
              >
                {reconciliation.status ===
                "reconciled"
                  ? "Balanced"
                  : "Review"}
              </strong>
            </header>

            <div className="finalisation-metrics">
              <article>
                <span>
                  Configured tax
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .configured_taxation,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Ledger taxation
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .ledger_taxation,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Difference
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .difference,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  As at
                </span>

                <strong>
                  {formatDate(
                    reconciliation.as_of,
                  )}
                </strong>
              </article>
            </div>

            <div className="finalisation-metrics">
              <article>
                <span>
                  Profit before tax
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .profit_before_tax,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Configured profit after tax
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .configured_profit_after_tax,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Ledger profit after tax
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .ledger_profit_after_tax,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Currency
                </span>

                <strong>
                  {reconciliation.currency ||
                    reportCurrency}
                </strong>
              </article>
            </div>
          </section>

          {reconciliation.status ===
          "not_configured" ? (
            <div className="ledger-system-notice">
              <strong>
                Tax is not configured
              </strong>

              <p>
                Record at least one tax
                calculation before attempting
                to reconcile taxation with
                the ledger.
              </p>
            </div>
          ) : null}

          {reconciliation.status ===
          "reconciled" ? (
            <div
              className="notes-status notes-status--success"
              role="status"
            >
              Configured taxation agrees
              with the posted ledger
              taxation.
            </div>
          ) : null}

          {reconciliation.status ===
          "under_posted" ? (
            <section className="finalisation-check-list finalisation-check-list--warnings">
              <header>
                <h3>
                  Outstanding tax adjustment
                </h3>
              </header>

              <article>
                <span>i</span>

                <div>
                  <strong>
                    Taxation is under-posted
                  </strong>

                  <p>
                    The ledger requires an
                    additional{" "}
                    {formatMoney(
                      reconciliation
                        .difference,
                      reconciliation.currency,
                    )}
                    {" "}to agree with the
                    recorded tax
                    calculations.
                  </p>
                </div>
              </article>
            </section>
          ) : null}

          {reconciliation.status ===
          "over_posted" ? (
            <section className="finalisation-check-list finalisation-check-list--blockers">
              <header>
                <h3>
                  Manual review required
                </h3>
              </header>

              <article>
                <span>!</span>

                <div>
                  <strong>
                    Ledger taxation exceeds configured taxation
                  </strong>

                  <p>
                    Automatic reversal is
                    deliberately blocked.
                    Review the source journal
                    entries and make a
                    controlled manual
                    correction where
                    appropriate.
                  </p>
                </div>
              </article>
            </section>
          ) : null}

          <section className="finalisation-readiness-panel">
            <header>
              <div>
                <span>
                  Calculation status
                </span>

                <h2>
                  Tax Calculation Control
                </h2>
              </div>

              <strong>
                {
                  reconciliation
                    .calculations.length
                }
                {" "}
                calculation
                {reconciliation
                  .calculations.length === 1
                  ? ""
                  : "s"}
              </strong>
            </header>

            <div className="finalisation-metrics">
              <article>
                <span>
                  Draft calculations
                </span>

                <strong>
                  {draftCalculationCount}
                </strong>
              </article>

              <article>
                <span>
                  Confirmed calculations
                </span>

                <strong>
                  {confirmedCalculationCount}
                </strong>
              </article>

              <article>
                <span>
                  Draft configured tax
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .draft_configured_taxation,
                    reconciliation.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Confirmed configured tax
                </span>

                <strong>
                  {formatMoney(
                    reconciliation
                      .confirmed_configured_taxation,
                    reconciliation.currency,
                  )}
                </strong>
              </article>
            </div>
          </section>

          <section className="finalisation-lock-panel">
            <div>
              <span>
                Posting accounts
              </span>

              <h2>
                Tax Adjustment Mapping
              </h2>

              <p>
                The controlled adjustment
                debits taxation expense and
                credits the selected current
                tax liability.
              </p>
            </div>

            <div className="finalisation-lock-panel__metadata">
              <span>
                Selected accounts
              </span>

              <strong>
                {selectedExpenseAccount
                  ? `${selectedExpenseAccount.account_code} — ${selectedExpenseAccount.account_name}`
                  : "Tax expense account unavailable"}
              </strong>

              <small>
                {selectedPayableAccount
                  ? `${selectedPayableAccount.account_code} — ${selectedPayableAccount.account_name}`
                  : "Tax payable account unavailable"}
              </small>
            </div>
          </section>

          {expenseAccounts.length ===
            0 ||
          payableAccounts.length ===
            0 ? (
            <div className="ledger-system-notice">
              <strong>
                Required tax accounts are missing
              </strong>

              <p>
                The Chart of Accounts must
                contain an active expense
                account classified as
                Taxation and an active
                liability classified as a
                Current Liability.
              </p>

              <Link
                className="secondary-button"
                href={`/companies/${companyId}/chart-of-accounts`}
              >
                Open Chart of Accounts
              </Link>
            </div>
          ) : null}

          {reportIsLocked ? (
            <div className="ledger-system-notice">
              <strong>
                Report is locked
              </strong>

              <p>
                A finalised, printed or
                archived report cannot
                receive another tax
                adjustment. Create a
                controlled revision first.
              </p>
            </div>
          ) : null}

          <section className="create-revision-panel">
            <div>
              <span>
                Controlled journal posting
              </span>

              <h2>
                Post Outstanding Tax
              </h2>

              <p>
                The adjustment posts only
                the positive outstanding
                difference and confirms the
                report’s draft tax
                calculations.
              </p>
            </div>

            <div className="ledger-form__footer">
              <Link
                className="secondary-button"
                href={`/reports/${reportId}/journal`}
              >
                Open General Journal
              </Link>

              <button
                className="primary-button"
                type="button"
                disabled={
                  !canPostAdjustment
                }
                onClick={() =>
                  setShowPostingDialog(
                    true,
                  )
                }
              >
                Post tax adjustment
              </button>
            </div>
          </section>

          {lastPostedJournal ? (
            <section className="finalisation-lock-panel finalisation-lock-panel--locked">
              <div>
                <span>
                  Adjustment posted
                </span>

                <h2>
                  {
                    lastPostedJournal
                      .entry_number
                  }
                </h2>

                <p>
                  {
                    lastPostedJournal
                      .description
                  }
                </p>

                <small>
                  Entry date:{" "}
                  {formatDate(
                    lastPostedJournal
                      .entry_date,
                  )}
                </small>
              </div>

              <div className="finalisation-lock-panel__metadata">
                <span>
                  Posted amount
                </span>

                <strong>
                  {formatMoney(
                    lastPostedJournal
                      .total_debit,
                    reconciliation.currency,
                  )}
                </strong>

                <small>
                  Status:{" "}
                  {
                    lastPostedJournal
                      .status
                  }
                </small>

                <Link
                  className="secondary-button"
                  href={`/reports/${reportId}/journal`}
                >
                  View journal entry
                </Link>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {showPostingDialog &&
      reconciliation ? (
        <PostTaxAdjustmentDialog
          reconciliation={
            reconciliation
          }
          expenseAccounts={
            expenseAccounts
          }
          payableAccounts={
            payableAccounts
          }
          defaultExpenseAccountId={
            expenseAccountId
          }
          defaultPayableAccountId={
            payableAccountId
          }
          reportPeriodStart={
            reportPeriodStart
          }
          reportPeriodEnd={
            reportPeriodEnd
          }
          isSubmitting={
            isSubmitting
          }
          onCancel={() =>
            setShowPostingDialog(
              false,
            )
          }
          onConfirm={
            handlePostAdjustment
          }
        />
      ) : null}
    </section>
  );
}