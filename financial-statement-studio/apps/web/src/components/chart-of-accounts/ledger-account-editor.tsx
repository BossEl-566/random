"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createLedgerAccount,
  updateLedgerAccount,
} from "@/lib/ledger-accounts-api";
import type {
  Company,
} from "@/types/company";
import {
  ACCOUNT_TYPE_DEFAULT_NORMAL_BALANCE,
  ACCOUNT_TYPE_OPTIONS,
  CASH_FLOW_CATEGORY_OPTIONS,
  NORMAL_BALANCE_OPTIONS,
  REPORT_CATEGORY_ACCOUNT_TYPE,
  REPORT_CATEGORY_OPTIONS,
  type AccountType,
  type CashFlowCategory,
  type LedgerAccount,
  type LedgerAccountCreatePayload,
  type NormalBalance,
  type ReportCategory,
} from "@/types/ledger-account";

type LedgerAccountEditorProps = {
  company: Company;
  accounts: LedgerAccount[];
  account: LedgerAccount | null;
  onClose: () => void;
  onSaved: (
    account: LedgerAccount,
  ) => Promise<void> | void;
};

type LedgerAccountFormValues = {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  reportCategory: ReportCategory;
  cashFlowCategory:
    | CashFlowCategory
    | "";
  normalBalance: NormalBalance;
  parentAccountId: string;
  description: string;
  displayOrder: string;
};

function getInitialValues(
  account: LedgerAccount | null,
): LedgerAccountFormValues {
  if (account) {
    return {
      accountCode:
        account.account_code,
      accountName:
        account.account_name,
      accountType:
        account.account_type,
      reportCategory:
        account.report_category,
      cashFlowCategory:
        account.cash_flow_category ??
        "",
      normalBalance:
        account.normal_balance,
      parentAccountId:
        account.parent_account_id ??
        "",
      description:
        account.description ?? "",
      displayOrder: String(
        account.display_order,
      ),
    };
  }

  return {
    accountCode: "",
    accountName: "",
    accountType: "expense",
    reportCategory:
      "administrative_expenses",
    cashFlowCategory:
      "operating",
    normalBalance: "debit",
    parentAccountId: "",
    description: "",
    displayOrder: "0",
  };
}

function nullableText(
  value: string,
): string | null {
  const cleanedValue = value.trim();

  return cleanedValue || null;
}

export function LedgerAccountEditor({
  company,
  accounts,
  account,
  onClose,
  onSaved,
}: LedgerAccountEditorProps) {
  const [values, setValues] =
    useState<LedgerAccountFormValues>(
      () => getInitialValues(account),
    );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  const isEditing = account !== null;

  const isProtectedSystemAccount =
    account?.is_system_account === true;

  const parentOptions =
    useMemo(() => {
      return accounts.filter(
        (candidate) =>
          candidate.id !== account?.id &&
          candidate.is_active,
      );
    }, [
      account?.id,
      accounts,
    ]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        onClose();
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
    onClose,
  ]);

  function setField<
    FieldName extends keyof LedgerAccountFormValues,
  >(
    fieldName: FieldName,
    value: LedgerAccountFormValues[FieldName],
  ): void {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  }

  function handleReportCategoryChange(
    reportCategory: ReportCategory,
  ): void {
    const accountType =
      REPORT_CATEGORY_ACCOUNT_TYPE[
        reportCategory
      ];

    setValues((currentValues) => ({
      ...currentValues,
      reportCategory,
      accountType,
      normalBalance:
        ACCOUNT_TYPE_DEFAULT_NORMAL_BALANCE[
          accountType
        ],
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const accountCode =
      values.accountCode
        .trim()
        .toUpperCase();

    const accountName =
      values.accountName.trim();

    if (!accountCode) {
      setFormError(
        "Enter an account code.",
      );
      return;
    }

    if (accountName.length < 2) {
      setFormError(
        "Enter an account name containing at least two characters.",
      );
      return;
    }

    const displayOrder = Number(
      values.displayOrder,
    );

    if (
      !Number.isInteger(displayOrder) ||
      displayOrder < 0
    ) {
      setFormError(
        "Display order must be a whole number of zero or greater.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let savedAccount: LedgerAccount;

      if (
        isEditing &&
        isProtectedSystemAccount
      ) {
        savedAccount =
          await updateLedgerAccount(
            account.id,
            {
              account_name:
                accountName,
              cash_flow_category:
                values.cashFlowCategory ||
                null,
              parent_account_id:
                nullableText(
                  values.parentAccountId,
                ),
              description:
                nullableText(
                  values.description,
                ),
              display_order:
                displayOrder,
            },
          );
      } else {
        const payload: LedgerAccountCreatePayload =
          {
            account_code:
              accountCode,
            account_name:
              accountName,
            account_type:
              values.accountType,
            report_category:
              values.reportCategory,
            cash_flow_category:
              values.cashFlowCategory ||
              null,
            normal_balance:
              values.normalBalance,
            parent_account_id:
              nullableText(
                values.parentAccountId,
              ),
            description:
              nullableText(
                values.description,
              ),
            display_order:
              displayOrder,
          };

        savedAccount = isEditing
          ? await updateLedgerAccount(
              account.id,
              payload,
            )
          : await createLedgerAccount(
              company.id,
              payload,
            );
      }

      await onSaved(savedAccount);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The ledger account could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
          onClose();
        }
      }}
    >
      <aside
        className="ledger-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-editor-title"
      >
        <header className="ledger-editor__header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? "Account settings"
                : "Custom ledger account"}
            </p>

            <h2 id="ledger-editor-title">
              {isEditing
                ? "Edit ledger account"
                : "Add ledger account"}
            </h2>

            <p>
              Classify each account correctly
              so the accounting engine knows
              where to place it in the
              financial statements.
            </p>
          </div>

          <button
            className="ledger-editor__close"
            type="button"
            aria-label="Close account form"
            disabled={isSubmitting}
            onClick={onClose}
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

          {isProtectedSystemAccount ? (
            <div className="ledger-system-notice">
              <strong>
                Protected system account
              </strong>

              <p>
                The account code, account
                type, report category and
                normal balance are protected
                because financial calculations
                depend on them.
              </p>
            </div>
          ) : null}

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>01</span>

              <div>
                <h3>
                  Account identity
                </h3>

                <p>
                  The account code must be
                  unique within{" "}
                  {company.name}.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Account code
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={30}
                  disabled={
                    isProtectedSystemAccount
                  }
                  value={
                    values.accountCode
                  }
                  placeholder="Example: 7150"
                  onChange={(event) =>
                    setField(
                      "accountCode",
                      event.target.value
                        .toUpperCase(),
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Display order
                  <strong>*</strong>
                </span>

                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={
                    values.displayOrder
                  }
                  onChange={(event) =>
                    setField(
                      "displayOrder",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Account name
                  <strong>*</strong>
                </span>

                <input
                  required
                  minLength={2}
                  maxLength={180}
                  value={
                    values.accountName
                  }
                  placeholder="Example: Software Subscriptions"
                  onChange={(event) =>
                    setField(
                      "accountName",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Description
                </span>

                <textarea
                  rows={4}
                  maxLength={2000}
                  value={
                    values.description
                  }
                  placeholder="Explain what should be recorded in this account"
                  onChange={(event) =>
                    setField(
                      "description",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>02</span>

              <div>
                <h3>
                  Financial classification
                </h3>

                <p>
                  The selected report category
                  automatically determines the
                  main account type.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Report category
                  <strong>*</strong>
                </span>

                <select
                  disabled={
                    isProtectedSystemAccount
                  }
                  value={
                    values.reportCategory
                  }
                  onChange={(event) =>
                    handleReportCategoryChange(
                      event.target
                        .value as ReportCategory,
                    )
                  }
                >
                  {REPORT_CATEGORY_OPTIONS.map(
                    (option) => (
                      <option
                        value={option.value}
                        key={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="form-field">
                <span>
                  Account type
                  <strong>*</strong>
                </span>

                <select
                  disabled
                  value={
                    values.accountType
                  }
                >
                  {ACCOUNT_TYPE_OPTIONS.map(
                    (option) => (
                      <option
                        value={option.value}
                        key={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                <small>
                  Determined automatically
                  from the report category.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Normal balance
                  <strong>*</strong>
                </span>

                <select
                  disabled={
                    isProtectedSystemAccount
                  }
                  value={
                    values.normalBalance
                  }
                  onChange={(event) =>
                    setField(
                      "normalBalance",
                      event.target
                        .value as NormalBalance,
                    )
                  }
                >
                  {NORMAL_BALANCE_OPTIONS.map(
                    (option) => (
                      <option
                        value={option.value}
                        key={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="form-field">
                <span>
                  Cash-flow category
                </span>

                <select
                  value={
                    values.cashFlowCategory
                  }
                  onChange={(event) =>
                    setField(
                      "cashFlowCategory",
                      event.target
                        .value as
                        | CashFlowCategory
                        | "",
                    )
                  }
                >
                  <option value="">
                    Not assigned
                  </option>

                  {CASH_FLOW_CATEGORY_OPTIONS.map(
                    (option) => (
                      <option
                        value={option.value}
                        key={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>03</span>

              <div>
                <h3>
                  Account grouping
                </h3>

                <p>
                  A parent account can be used
                  later to group related
                  accounts in reports.
                </p>
              </div>
            </div>

            <label className="form-field">
              <span>
                Parent account
              </span>

              <select
                value={
                  values.parentAccountId
                }
                onChange={(event) =>
                  setField(
                    "parentAccountId",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  No parent account
                </option>

                {parentOptions.map(
                  (candidate) => (
                    <option
                      value={candidate.id}
                      key={candidate.id}
                    >
                      {candidate.account_code}
                      {" — "}
                      {candidate.account_name}
                    </option>
                  ),
                )}
              </select>
            </label>
          </section>

          <footer className="ledger-form__footer">
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving account..."
                : isEditing
                  ? "Save account"
                  : "Add account"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}