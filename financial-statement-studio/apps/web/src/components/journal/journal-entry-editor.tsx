"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createJournalEntry,
  updateJournalEntry,
} from "@/lib/journal-api";
import type {
  FinancialReport,
} from "@/types/financial-report";
import {
  JOURNAL_ENTRY_TYPE_OPTIONS,
  type JournalEntry,
  type JournalEntryCreatePayload,
  type JournalEntryType,
  type JournalLineInput,
} from "@/types/journal-entry";
import type {
  LedgerAccount,
} from "@/types/ledger-account";

type JournalEntryEditorProps = {
  report: FinancialReport;
  accounts: LedgerAccount[];
  entry: JournalEntry | null;
  onClose: () => void;
  onSaved: (
    entry: JournalEntry,
  ) => Promise<void> | void;
};

type JournalLineForm = {
  localId: string;
  ledgerAccountId: string;
  description: string;
  debit: string;
  credit: string;
};

type JournalEntryFormValues = {
  entryDate: string;
  entryType: JournalEntryType;
  description: string;
  reference: string;
  lines: JournalLineForm[];
};

let nextLocalLineId = 1;

function createLocalLineId(): string {
  const currentId =
    nextLocalLineId;

  nextLocalLineId += 1;

  return [
    "journal-line",
    Date.now(),
    currentId,
  ].join("-");
}

function createBlankLine():
  JournalLineForm {
  return {
    localId:
      createLocalLineId(),
    ledgerAccountId: "",
    description: "",
    debit: "",
    credit: "",
  };
}

function getTodayDate(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function getDefaultEntryDate(
  report: FinancialReport,
): string {
  const today = getTodayDate();

  if (today < report.period_start) {
    return report.period_start;
  }

  if (today > report.period_end) {
    return report.period_end;
  }

  return today;
}

function getInitialValues(
  report: FinancialReport,
  entry: JournalEntry | null,
): JournalEntryFormValues {
  if (entry) {
    return {
      entryDate:
        entry.entry_date,
      entryType:
        entry.entry_type,
      description:
        entry.description,
      reference:
        entry.reference ?? "",
      lines: entry.lines.map(
        (line, index) => ({
          localId:
            line.id ||
            `existing-line-${index}`,
          ledgerAccountId:
            line.ledger_account_id,
          description:
            line.description ?? "",
          debit:
            Number(line.debit) > 0
              ? String(line.debit)
              : "",
          credit:
            Number(line.credit) > 0
              ? String(line.credit)
              : "",
        }),
      ),
    };
  }

  return {
    entryDate:
      getDefaultEntryDate(report),
    entryType: "standard",
    description: "",
    reference: "",
    lines: [
      createBlankLine(),
      createBlankLine(),
    ],
  };
}

function nullableText(
  value: string,
): string | null {
  const cleanedValue =
    value.trim();

  return cleanedValue || null;
}

function parseMoneyToCents(
  value: string,
): bigint | null {
  const normalizedValue =
    value
      .replace(/,/g, "")
      .trim();

  if (normalizedValue === "") {
    return 0n;
  }

  if (
    !/^\d+(\.\d{0,2})?$/.test(
      normalizedValue,
    )
  ) {
    return null;
  }

  const [
    wholePart,
    fractionPart = "",
  ] = normalizedValue.split(".");

  const wholeCents =
    BigInt(wholePart) * 100n;

  const fractionCents =
    BigInt(
      fractionPart
        .padEnd(2, "0")
        .slice(0, 2),
    );

  return (
    wholeCents +
    fractionCents
  );
}

function centsToMoney(
  cents: bigint,
): string {
  const wholePart =
    cents / 100n;

  const fractionPart =
    cents % 100n;

  return (
    `${wholePart.toString()}.` +
    fractionPart
      .toString()
      .padStart(2, "0")
  );
}

function formatCents(
  cents: bigint,
): string {
  const wholePart =
    cents / 100n;

  const fractionPart =
    cents % 100n;

  const groupedWhole =
    wholePart
      .toString()
      .replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ",",
      );

  return (
    `${groupedWhole}.` +
    fractionPart
      .toString()
      .padStart(2, "0")
  );
}

export function JournalEntryEditor({
  report,
  accounts,
  entry,
  onClose,
  onSaved,
}: JournalEntryEditorProps) {
  const [values, setValues] =
    useState<JournalEntryFormValues>(
      () =>
        getInitialValues(
          report,
          entry,
        ),
    );

  const [formError, setFormError] =
    useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const isEditing =
    entry !== null;

  const activeAccounts =
    useMemo(() => {
      const selectedAccountIds =
        new Set(
          values.lines.map(
            (line) =>
              line.ledgerAccountId,
          ),
        );

      return accounts.filter(
        (account) =>
          account.is_active ||
          selectedAccountIds.has(
            account.id,
          ),
      );
    }, [
      accounts,
      values.lines,
    ]);

  const totals =
    useMemo(() => {
      let debitTotal = 0n;
      let creditTotal = 0n;
      let hasInvalidAmount =
        false;

      for (
        const line
        of values.lines
      ) {
        const debitCents =
          parseMoneyToCents(
            line.debit,
          );

        const creditCents =
          parseMoneyToCents(
            line.credit,
          );

        if (
          debitCents === null ||
          creditCents === null
        ) {
          hasInvalidAmount = true;
          continue;
        }

        debitTotal += debitCents;
        creditTotal += creditCents;
      }

      return {
        debitTotal,
        creditTotal,
        difference:
          debitTotal -
          creditTotal,
        hasInvalidAmount,
        isBalanced:
          !hasInvalidAmount &&
          debitTotal > 0n &&
          debitTotal ===
            creditTotal,
      };
    }, [values.lines]);

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
    FieldName extends keyof JournalEntryFormValues,
  >(
    fieldName: FieldName,
    value:
      JournalEntryFormValues[FieldName],
  ): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        [fieldName]: value,
      }),
    );
  }

  function updateLine(
    localId: string,
    changes: Partial<
      JournalLineForm
    >,
  ): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        lines:
          currentValues.lines.map(
            (line) =>
              line.localId ===
              localId
                ? {
                    ...line,
                    ...changes,
                  }
                : line,
          ),
      }),
    );
  }

  function handleDebitChange(
    line: JournalLineForm,
    value: string,
  ): void {
    const debitCents =
      parseMoneyToCents(value);

    updateLine(
      line.localId,
      {
        debit: value,
        credit:
          debitCents !== null &&
          debitCents > 0n
            ? ""
            : line.credit,
      },
    );
  }

  function handleCreditChange(
    line: JournalLineForm,
    value: string,
  ): void {
    const creditCents =
      parseMoneyToCents(value);

    updateLine(
      line.localId,
      {
        credit: value,
        debit:
          creditCents !== null &&
          creditCents > 0n
            ? ""
            : line.debit,
      },
    );
  }

  function addLine(): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        lines: [
          ...currentValues.lines,
          createBlankLine(),
        ],
      }),
    );
  }

  function removeLine(
    localId: string,
  ): void {
    setValues(
      (currentValues) => {
        if (
          currentValues.lines
            .length <= 2
        ) {
          return currentValues;
        }

        return {
          ...currentValues,
          lines:
            currentValues.lines.filter(
              (line) =>
                line.localId !==
                localId,
            ),
        };
      },
    );
  }

  function handleEntryTypeChange(
    entryType: JournalEntryType,
  ): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        entryType,
        entryDate:
          entryType ===
          "opening_balance"
            ? report.period_start
            : currentValues.entryDate,
      }),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const description =
      values.description.trim();

    if (
      description.length < 2
    ) {
      setFormError(
        "Enter a journal description containing at least two characters.",
      );
      return;
    }

    if (
      values.entryDate <
        report.period_start ||
      values.entryDate >
        report.period_end
    ) {
      setFormError(
        `Entry date must be between ${report.period_start} and ${report.period_end}.`,
      );
      return;
    }

    if (
      values.entryType ===
        "opening_balance" &&
      values.entryDate !==
        report.period_start
    ) {
      setFormError(
        "Opening balances must use the report’s period start date.",
      );
      return;
    }

    if (
      values.lines.length < 2
    ) {
      setFormError(
        "A journal entry requires at least two lines.",
      );
      return;
    }

    const payloadLines:
      JournalLineInput[] = [];

    for (
      let index = 0;
      index <
      values.lines.length;
      index += 1
    ) {
      const line =
        values.lines[index];

      if (
        !line.ledgerAccountId
      ) {
        setFormError(
          `Select an account on line ${index + 1}.`,
        );
        return;
      }

      const debitCents =
        parseMoneyToCents(
          line.debit,
        );

      const creditCents =
        parseMoneyToCents(
          line.credit,
        );

      if (
        debitCents === null ||
        creditCents === null
      ) {
        setFormError(
          `Line ${index + 1} contains an invalid amount. Use no more than two decimal places.`,
        );
        return;
      }

      const hasDebit =
        debitCents > 0n;

      const hasCredit =
        creditCents > 0n;

      if (
        hasDebit === hasCredit
      ) {
        setFormError(
          `Line ${index + 1} must contain either a debit or a credit, but not both.`,
        );
        return;
      }

      payloadLines.push({
        ledger_account_id:
          line.ledgerAccountId,
        description:
          nullableText(
            line.description,
          ),
        debit:
          centsToMoney(
            debitCents,
          ),
        credit:
          centsToMoney(
            creditCents,
          ),
      });
    }

    if (!totals.isBalanced) {
      setFormError(
        `The journal is not balanced. Debits: ${formatCents(
          totals.debitTotal,
        )}; credits: ${formatCents(
          totals.creditTotal,
        )}.`,
      );
      return;
    }

    const payload:
      JournalEntryCreatePayload = {
        entry_date:
          values.entryDate,
        entry_type:
          values.entryType,
        source:
          entry?.source ??
          "manual",
        description,
        reference:
          nullableText(
            values.reference,
          ),
        lines: payloadLines,
      };

    setIsSubmitting(true);

    try {
      const savedEntry =
        isEditing
          ? await updateJournalEntry(
              entry.id,
              payload,
            )
          : await createJournalEntry(
              report.id,
              payload,
            );

      await onSaved(
        savedEntry,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The journal entry could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="journal-editor-backdrop"
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
        className="journal-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-editor-title"
      >
        <header className="journal-editor__header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? "Draft journal"
                : "Double-entry journal"}
            </p>

            <h2 id="journal-editor-title">
              {isEditing
                ? `Edit ${entry.entry_number}`
                : "Create journal entry"}
            </h2>

            <p>
              Every debit must be matched
              by an equal credit before the
              journal can be saved.
            </p>
          </div>

          <button
            className="journal-editor__close"
            type="button"
            aria-label="Close journal form"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="journal-entry-form"
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

          <section className="journal-form-section">
            <div className="journal-form-section__heading">
              <span>01</span>

              <div>
                <h3>
                  Journal information
                </h3>

                <p>
                  Describe the transaction
                  and select the relevant
                  accounting date.
                </p>
              </div>
            </div>

            <div className="journal-form-grid">
              <label className="form-field">
                <span>
                  Entry type
                  <strong>*</strong>
                </span>

                <select
                  disabled={isEditing}
                  value={
                    values.entryType
                  }
                  onChange={(event) =>
                    handleEntryTypeChange(
                      event.target
                        .value as JournalEntryType,
                    )
                  }
                >
                  {JOURNAL_ENTRY_TYPE_OPTIONS.map(
                    (option) => (
                      <option
                        value={
                          option.value
                        }
                        key={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                {isEditing ? (
                  <small>
                    Entry type is locked
                    after creation to preserve
                    its numbering prefix.
                  </small>
                ) : null}
              </label>

              <label className="form-field">
                <span>
                  Entry date
                  <strong>*</strong>
                </span>

                <input
                  required
                  type="date"
                  min={
                    report.period_start
                  }
                  max={
                    report.period_end
                  }
                  disabled={
                    values.entryType ===
                    "opening_balance"
                  }
                  value={
                    values.entryDate
                  }
                  onChange={(event) =>
                    setField(
                      "entryDate",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Description
                  <strong>*</strong>
                </span>

                <input
                  required
                  minLength={2}
                  maxLength={500}
                  value={
                    values.description
                  }
                  placeholder="Example: Cash received from customer"
                  onChange={(event) =>
                    setField(
                      "description",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Reference
                </span>

                <input
                  maxLength={120}
                  value={
                    values.reference
                  }
                  placeholder="Invoice number, receipt number or internal reference"
                  onChange={(event) =>
                    setField(
                      "reference",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="journal-form-section">
            <div className="journal-form-section__heading journal-form-section__heading--lines">
              <span>02</span>

              <div>
                <h3>
                  Debit and credit lines
                </h3>

                <p>
                  Enter one amount on each
                  line. Adding a debit clears
                  the credit on that line and
                  vice versa.
                </p>
              </div>

              <button
                className="journal-add-line-button"
                type="button"
                onClick={addLine}
              >
                Add line
              </button>
            </div>

            <div className="journal-entry-lines">
              <div className="journal-entry-lines__header">
                <span>Account</span>
                <span>
                  Line description
                </span>
                <span>Debit</span>
                <span>Credit</span>
                <span />
              </div>

              {values.lines.map(
                (line, index) => (
                  <div
                    className="journal-entry-line"
                    key={line.localId}
                  >
                    <label>
                      <span className="journal-line-mobile-label">
                        Account
                      </span>

                      <select
                        required
                        value={
                          line.ledgerAccountId
                        }
                        onChange={(event) =>
                          updateLine(
                            line.localId,
                            {
                              ledgerAccountId:
                                event.target
                                  .value,
                            },
                          )
                        }
                      >
                        <option value="">
                          Select account
                        </option>

                        {activeAccounts.map(
                          (account) => (
                            <option
                              value={
                                account.id
                              }
                              disabled={
                                !account.is_active
                              }
                              key={
                                account.id
                              }
                            >
                              {
                                account.account_code
                              }
                              {" — "}
                              {
                                account.account_name
                              }
                              {!account.is_active
                                ? " (Inactive)"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="journal-line-mobile-label">
                        Description
                      </span>

                      <input
                        maxLength={500}
                        value={
                          line.description
                        }
                        placeholder={`Line ${index + 1}`}
                        onChange={(event) =>
                          updateLine(
                            line.localId,
                            {
                              description:
                                event.target
                                  .value,
                            },
                          )
                        }
                      />
                    </label>

                    <label>
                      <span className="journal-line-mobile-label">
                        Debit
                      </span>

                      <input
                        inputMode="decimal"
                        value={
                          line.debit
                        }
                        placeholder="0.00"
                        onChange={(event) =>
                          handleDebitChange(
                            line,
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <label>
                      <span className="journal-line-mobile-label">
                        Credit
                      </span>

                      <input
                        inputMode="decimal"
                        value={
                          line.credit
                        }
                        placeholder="0.00"
                        onChange={(event) =>
                          handleCreditChange(
                            line,
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <button
                      className="journal-remove-line"
                      type="button"
                      aria-label={`Remove journal line ${index + 1}`}
                      disabled={
                        values.lines
                          .length <= 2
                      }
                      onClick={() =>
                        removeLine(
                          line.localId,
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ),
              )}
            </div>

            <div
              className={`journal-balance-panel ${
                totals.isBalanced
                  ? "journal-balance-panel--balanced"
                  : "journal-balance-panel--unbalanced"
              }`}
            >
              <div>
                <span>
                  Total debits
                </span>

                <strong>
                  {report.currency}
                  {" "}
                  {formatCents(
                    totals.debitTotal,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Total credits
                </span>

                <strong>
                  {report.currency}
                  {" "}
                  {formatCents(
                    totals.creditTotal,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Difference
                </span>

                <strong>
                  {report.currency}
                  {" "}
                  {formatCents(
                    totals.difference <
                      0n
                      ? -totals.difference
                      : totals.difference,
                  )}
                </strong>
              </div>

              <div className="journal-balance-status">
                <span>
                  {totals.isBalanced
                    ? "Balanced"
                    : "Not balanced"}
                </span>
              </div>
            </div>
          </section>

          <footer className="journal-form-footer">
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
              disabled={
                isSubmitting ||
                !totals.isBalanced
              }
            >
              {isSubmitting
                ? "Saving journal..."
                : isEditing
                  ? "Save draft changes"
                  : "Save as draft"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}