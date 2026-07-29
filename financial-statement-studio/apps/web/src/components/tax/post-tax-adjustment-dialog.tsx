"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  LedgerAccount,
} from "@/types/ledger-account";
import type {
  PostTaxAdjustmentPayload,
  TaxDecimal,
  TaxReconciliation,
} from "@/types/tax-configuration";

type PostTaxAdjustmentDialogProps = {
  reconciliation: TaxReconciliation;

  expenseAccounts: LedgerAccount[];
  payableAccounts: LedgerAccount[];

  defaultExpenseAccountId: string;
  defaultPayableAccountId: string;

  reportPeriodStart: string;
  reportPeriodEnd: string;

  isSubmitting: boolean;

  onCancel: () => void;

  onConfirm: (
    payload: PostTaxAdjustmentPayload,
  ) => Promise<void> | void;
};

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

export function PostTaxAdjustmentDialog({
  reconciliation,
  expenseAccounts,
  payableAccounts,
  defaultExpenseAccountId,
  defaultPayableAccountId,
  reportPeriodStart,
  reportPeriodEnd,
  isSubmitting,
  onCancel,
  onConfirm,
}: PostTaxAdjustmentDialogProps) {
  const [
    taxExpenseAccountId,
    setTaxExpenseAccountId,
  ] = useState(
    defaultExpenseAccountId,
  );

  const [
    taxPayableAccountId,
    setTaxPayableAccountId,
  ] = useState(
    defaultPayableAccountId,
  );

  const [
    entryDate,
    setEntryDate,
  ] = useState(
    reportPeriodEnd,
  );

  const [
    reason,
    setReason,
  ] = useState(
    "Post the outstanding configured tax adjustment.",
  );

  const [
    acknowledgeExistingTaxation,
    setAcknowledgeExistingTaxation,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  const existingLedgerTax =
    Number(
      reconciliation.ledger_taxation,
    );

  const requiresAcknowledgement =
    Number.isFinite(
      existingLedgerTax,
    ) &&
    existingLedgerTax > 0;

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        onCancel();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isSubmitting,
    onCancel,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setFormError(null);

    if (!taxExpenseAccountId) {
      setFormError(
        "Select the income tax expense account.",
      );
      return;
    }

    if (!taxPayableAccountId) {
      setFormError(
        "Select the tax payable account.",
      );
      return;
    }

    if (
      taxExpenseAccountId ===
      taxPayableAccountId
    ) {
      setFormError(
        "The expense and payable accounts must be different.",
      );
      return;
    }

    if (!entryDate) {
      setFormError(
        "Select the journal entry date.",
      );
      return;
    }

    if (
      entryDate <
        reportPeriodStart ||
      entryDate >
        reportPeriodEnd
    ) {
      setFormError(
        "The journal entry date must fall within the report period.",
      );
      return;
    }

    const cleanedReason =
      reason.trim();

    if (
      cleanedReason.length < 3
    ) {
      setFormError(
        "Enter a posting reason containing at least three characters.",
      );
      return;
    }

    if (
      requiresAcknowledgement &&
      !acknowledgeExistingTaxation
    ) {
      setFormError(
        "Acknowledge the taxation already posted to the ledger before continuing.",
      );
      return;
    }

    await onConfirm({
      tax_expense_account_id:
        taxExpenseAccountId,

      tax_payable_account_id:
        taxPayableAccountId,

      entry_date:
        entryDate,

      reason:
        cleanedReason,

      acknowledge_existing_taxation:
        acknowledgeExistingTaxation,
    });
  }

  return (
    <div
      className="ledger-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSubmitting
        ) {
          onCancel();
        }
      }}
    >
      <aside
        className="ledger-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-tax-adjustment-title"
      >
        <header className="ledger-editor__header">
          <div>
            <p className="eyebrow">
              Controlled tax posting
            </p>

            <h2 id="post-tax-adjustment-title">
              Post Tax Adjustment
            </h2>

            <p>
              The system will debit an
              income tax expense account
              and credit a tax payable
              account for the outstanding
              difference only.
            </p>
          </div>

          <button
            className="ledger-editor__close"
            type="button"
            aria-label="Close tax posting form"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <form
          className="ledger-form"
          onSubmit={handleSubmit}
        >
          {formError ? (
            <div
              className="form-alert form-alert--error"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <section className="finalisation-lock-panel">
            <div>
              <span>
                Outstanding taxation
              </span>

              <h2>
                {formatMoney(
                  reconciliation.difference,
                  reconciliation.currency,
                )}
              </h2>

              <p>
                Configured taxation less
                taxation already posted to
                the ledger.
              </p>
            </div>

            <div className="finalisation-lock-panel__metadata">
              <span>
                Current reconciliation
              </span>

              <strong>
                {formatMoney(
                  reconciliation
                    .configured_taxation,
                  reconciliation.currency,
                )}
              </strong>

              <small>
                Ledger taxation:{" "}
                {formatMoney(
                  reconciliation
                    .ledger_taxation,
                  reconciliation.currency,
                )}
              </small>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>01</span>

              <div>
                <h3>
                  Posting accounts
                </h3>

                <p>
                  Select the exact ledger
                  accounts that should
                  receive the adjustment.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Income tax expense
                  <strong>*</strong>
                </span>

                <select
                  required
                  value={
                    taxExpenseAccountId
                  }
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setTaxExpenseAccountId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select expense account
                  </option>

                  {expenseAccounts.map(
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

                <small>
                  This account will be
                  debited.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Tax payable
                  <strong>*</strong>
                </span>

                <select
                  required
                  value={
                    taxPayableAccountId
                  }
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setTaxPayableAccountId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select payable account
                  </option>

                  {payableAccounts.map(
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

                <small>
                  This account will be
                  credited.
                </small>
              </label>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>02</span>

              <div>
                <h3>
                  Posting information
                </h3>

                <p>
                  The adjustment is created
                  as a posted system
                  journal entry.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Entry date
                  <strong>*</strong>
                </span>

                <input
                  required
                  type="date"
                  min={reportPeriodStart}
                  max={reportPeriodEnd}
                  value={entryDate}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setEntryDate(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Posting reason
                  <strong>*</strong>
                </span>

                <textarea
                  required
                  rows={4}
                  minLength={3}
                  maxLength={2000}
                  value={reason}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setReason(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          {requiresAcknowledgement ? (
            <section className="ledger-form__section">
              <div className="ledger-system-notice">
                <strong>
                  Existing taxation detected
                </strong>

                <p>
                  The ledger already contains{" "}
                  {formatMoney(
                    reconciliation
                      .ledger_taxation,
                    reconciliation.currency,
                  )}
                  {" "}of taxation. The
                  adjustment will post only
                  the remaining difference.
                </p>
              </div>

              <label className="form-field">
                <span>
                  <input
                    type="checkbox"
                    checked={
                      acknowledgeExistingTaxation
                    }
                    disabled={isSubmitting}
                    onChange={(event) =>
                      setAcknowledgeExistingTaxation(
                        event.target.checked,
                      )
                    }
                  />

                  {" "}
                  I have reviewed and
                  acknowledge the taxation
                  already posted to the
                  ledger.
                </span>
              </label>
            </section>
          ) : null}

          <footer className="ledger-form__footer">
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              className="finalisation-danger-button"
              type="submit"
              disabled={
                isSubmitting ||
                expenseAccounts.length ===
                  0 ||
                payableAccounts.length ===
                  0
              }
            >
              {isSubmitting
                ? "Posting adjustment..."
                : "Post tax adjustment"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}