"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  retireTaxRule,
} from "@/lib/tax-configuration-api";
import type {
  TaxRule,
} from "@/types/tax-configuration";

type RetireTaxRuleDialogProps = {
  rule: TaxRule;
  suggestedDate: string;

  onCancel: () => void;

  onRetired: (
    rule: TaxRule,
  ) => Promise<void> | void;
};

export function RetireTaxRuleDialog({
  rule,
  suggestedDate,
  onCancel,
  onRetired,
}: RetireTaxRuleDialogProps) {
  const defaultDate =
    suggestedDate >=
    rule.effective_from
      ? suggestedDate
      : rule.effective_from;

  const [
    effectiveTo,
    setEffectiveTo,
  ] = useState(
    rule.effective_to ??
      defaultDate,
  );

  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

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

    if (!effectiveTo) {
      setFormError(
        "Select the rule’s final effective date.",
      );
      return;
    }

    if (
      effectiveTo <
      rule.effective_from
    ) {
      setFormError(
        "The retirement date cannot be before the rule’s start date.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const retiredRule =
        await retireTaxRule(
          rule.id,
          {
            effective_to:
              effectiveTo,
          },
        );

      await onRetired(
        retiredRule,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The tax rule could not be retired.",
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
          onCancel();
        }
      }}
    >
      <aside
        className="ledger-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="retire-tax-rule-title"
      >
        <header className="ledger-editor__header">
          <div>
            <p className="eyebrow">
              Controlled rule retirement
            </p>

            <h2 id="retire-tax-rule-title">
              Retire Tax Rule
            </h2>

            <p>
              {rule.rule_code}
              {" — "}
              {rule.rule_name}
            </p>
          </div>

          <button
            className="ledger-editor__close"
            type="button"
            aria-label="Close retirement form"
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

          <div className="ledger-system-notice">
            <strong>
              Historical records remain valid
            </strong>

            <p>
              Retirement does not delete the
              rule. Calculations dated within
              its effective period can still
              identify and use it.
            </p>
          </div>

          <section className="ledger-form__section">
            <label className="form-field">
              <span>
                Final effective date
                <strong>*</strong>
              </span>

              <input
                required
                type="date"
                min={
                  rule.effective_from
                }
                value={
                  effectiveTo
                }
                onChange={(event) =>
                  setEffectiveTo(
                    event.target.value,
                  )
                }
              />

              <small>
                The rule will not apply to
                calculation dates after this
                date.
              </small>
            </label>
          </section>

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
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Retiring rule..."
                : "Retire rule"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}