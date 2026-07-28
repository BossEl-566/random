"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createTaxRule,
  updateTaxRule,
} from "@/lib/tax-configuration-api";
import {
  TAX_CALCULATION_METHOD_OPTIONS,
  type TaxCalculationMethod,
  type TaxProfile,
  type TaxRule,
  type TaxRuleCreatePayload,
  type TaxRuleUpdatePayload,
} from "@/types/tax-configuration";

type TaxRuleEditorProps = {
  profile: TaxProfile;
  reportCurrency: string;
  reportPeriodStart: string;
  rule: TaxRule | null;

  onClose: () => void;

  onSaved: (
    rule: TaxRule,
  ) => Promise<void> | void;
};

type TaxRuleFormValues = {
  ruleCode: string;
  ruleName: string;
  taxType: string;

  calculationMethod:
    TaxCalculationMethod;

  ratePercentage: string;
  fixedAmount: string;

  currency: string;

  effectiveFrom: string;
  effectiveTo: string;

  taxpayerCategory: string;
  businessActivity: string;

  sourceReference: string;
  notes: string;

  displayOrder: string;
};

function getInitialValues(
  rule: TaxRule | null,
  reportCurrency: string,
  reportPeriodStart: string,
): TaxRuleFormValues {
  if (rule) {
    return {
      ruleCode: rule.rule_code,
      ruleName: rule.rule_name,
      taxType: rule.tax_type,

      calculationMethod:
        rule.calculation_method,

      ratePercentage:
        rule.rate_percentage ?? "",

      fixedAmount:
        rule.fixed_amount ?? "",

      currency: rule.currency,

      effectiveFrom:
        rule.effective_from,

      effectiveTo:
        rule.effective_to ?? "",

      taxpayerCategory:
        rule.taxpayer_category ?? "",

      businessActivity:
        rule.business_activity ?? "",

      sourceReference:
        rule.source_reference ?? "",

      notes: rule.notes ?? "",

      displayOrder: String(
        rule.display_order,
      ),
    };
  }

  return {
    ruleCode: "",
    ruleName: "",
    taxType:
      "corporate_income_tax",

    calculationMethod:
      "percentage",

    ratePercentage: "",
    fixedAmount: "",

    currency:
      reportCurrency || "GHS",

    effectiveFrom:
      reportPeriodStart,

    effectiveTo: "",

    taxpayerCategory:
      "",

    businessActivity:
      "",

    sourceReference:
      "",

    notes: "",

    displayOrder: "10",
  };
}

function nullableText(
  value: string,
): string | null {
  const cleanedValue = value.trim();

  return cleanedValue || null;
}

export function TaxRuleEditor({
  profile,
  reportCurrency,
  reportPeriodStart,
  rule,
  onClose,
  onSaved,
}: TaxRuleEditorProps) {
  const [
    values,
    setValues,
  ] = useState<TaxRuleFormValues>(
    () =>
      getInitialValues(
        rule,
        reportCurrency,
        reportPeriodStart,
      ),
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

  const isEditing =
    rule !== null;

  const coreFieldsAreLocked =
    rule?.status === "active";

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
    FieldName extends keyof TaxRuleFormValues,
  >(
    fieldName: FieldName,
    value: TaxRuleFormValues[FieldName],
  ): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        [fieldName]: value,
      }),
    );
  }

  function handleMethodChange(
    calculationMethod:
      TaxCalculationMethod,
  ): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        calculationMethod,
        ratePercentage:
          calculationMethod ===
          "percentage"
            ? currentValues
                .ratePercentage
            : "",
        fixedAmount:
          calculationMethod ===
          "fixed_amount"
            ? currentValues
                .fixedAmount
            : "",
      }),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setFormError(null);

    const ruleCode =
      values.ruleCode
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "-");

    const ruleName =
      values.ruleName.trim();

    const taxType =
      values.taxType
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

    const currency =
      values.currency
        .trim()
        .toUpperCase();

    const displayOrder =
      Number(
        values.displayOrder,
      );

    if (!ruleCode) {
      setFormError(
        "Enter a tax rule code.",
      );
      return;
    }

    if (!ruleName) {
      setFormError(
        "Enter a tax rule name.",
      );
      return;
    }

    if (!taxType) {
      setFormError(
        "Enter the tax type.",
      );
      return;
    }

    if (
      !/^[A-Z]{3}$/.test(
        currency,
      )
    ) {
      setFormError(
        "Currency must contain exactly three letters.",
      );
      return;
    }

    if (!values.effectiveFrom) {
      setFormError(
        "Select the effective start date.",
      );
      return;
    }

    if (
      values.effectiveTo &&
      values.effectiveTo <
        values.effectiveFrom
    ) {
      setFormError(
        "Effective end date cannot be before the start date.",
      );
      return;
    }

    if (
      !Number.isInteger(
        displayOrder,
      ) ||
      displayOrder < 0
    ) {
      setFormError(
        "Display order must be a whole number of zero or greater.",
      );
      return;
    }

    if (
      values.calculationMethod ===
      "percentage"
    ) {
      const rate =
        Number(
          values.ratePercentage,
        );

      if (
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 100
      ) {
        setFormError(
          "Percentage rate must be between 0 and 100.",
        );
        return;
      }
    }

    if (
      values.calculationMethod ===
      "fixed_amount"
    ) {
      const fixedAmount =
        Number(
          values.fixedAmount,
        );

      if (
        !Number.isFinite(
          fixedAmount,
        ) ||
        fixedAmount < 0
      ) {
        setFormError(
          "Fixed amount must be zero or greater.",
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let savedRule: TaxRule;

      if (
        isEditing &&
        coreFieldsAreLocked
      ) {
        const payload:
          TaxRuleUpdatePayload = {
            source_reference:
              nullableText(
                values.sourceReference,
              ),

            notes:
              nullableText(
                values.notes,
              ),

            display_order:
              displayOrder,
          };

        savedRule =
          await updateTaxRule(
            rule.id,
            payload,
          );
      } else {
        const payload:
          TaxRuleCreatePayload = {
            rule_code:
              ruleCode,

            rule_name:
              ruleName,

            tax_type:
              taxType,

            calculation_method:
              values
                .calculationMethod,

            rate_percentage:
              values
                .calculationMethod ===
              "percentage"
                ? values
                    .ratePercentage
                    .trim()
                : null,

            fixed_amount:
              values
                .calculationMethod ===
              "fixed_amount"
                ? values
                    .fixedAmount
                    .trim()
                : null,

            currency,

            effective_from:
              values.effectiveFrom,

            effective_to:
              nullableText(
                values.effectiveTo,
              ),

            taxpayer_category:
              nullableText(
                values
                  .taxpayerCategory,
              ),

            business_activity:
              nullableText(
                values
                  .businessActivity,
              ),

            source_reference:
              nullableText(
                values
                  .sourceReference,
              ),

            notes:
              nullableText(
                values.notes,
              ),

            display_order:
              displayOrder,
          };

        savedRule = isEditing
          ? await updateTaxRule(
              rule.id,
              payload,
            )
          : await createTaxRule(
              profile.id,
              payload,
            );
      }

      await onSaved(
        savedRule,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The tax rule could not be saved.",
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
        aria-labelledby="tax-rule-editor-title"
      >
        <header className="ledger-editor__header">
          <div>
            <p className="eyebrow">
              {profile.profile_name}
            </p>

            <h2 id="tax-rule-editor-title">
              {isEditing
                ? "Edit Tax Rule"
                : "Add Tax Rule"}
            </h2>

            <p>
              Tax rules are effective-dated.
              The system selects the rule
              whose period covers the tax
              calculation date.
            </p>
          </div>

          <button
            className="ledger-editor__close"
            type="button"
            aria-label="Close tax rule form"
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

          {coreFieldsAreLocked ? (
            <div className="ledger-system-notice">
              <strong>
                Active tax rule
              </strong>

              <p>
                The calculation method,
                amount, rate and effective
                dates are locked because the
                rule may already support tax
                calculations. Only its notes,
                source reference and display
                order can be updated.
              </p>
            </div>
          ) : null}

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>01</span>

              <div>
                <h3>
                  Rule identity
                </h3>

                <p>
                  Use a consistent code for
                  each tax type and effective
                  period.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Rule code
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={100}
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values.ruleCode
                  }
                  placeholder="Example: CIT-STANDARD"
                  onChange={(event) =>
                    setField(
                      "ruleCode",
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
                  Rule name
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={255}
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values.ruleName
                  }
                  placeholder="Example: Corporate Income Tax"
                  onChange={(event) =>
                    setField(
                      "ruleName",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Tax type
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={80}
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values.taxType
                  }
                  placeholder="corporate_income_tax"
                  onChange={(event) =>
                    setField(
                      "taxType",
                      event.target.value,
                    )
                  }
                />

                <small>
                  Example:
                  corporate_income_tax,
                  levy or custom.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Currency
                  <strong>*</strong>
                </span>

                <input
                  required
                  minLength={3}
                  maxLength={3}
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values.currency
                  }
                  placeholder="GHS"
                  onChange={(event) =>
                    setField(
                      "currency",
                      event.target.value
                        .toUpperCase(),
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
                  Calculation
                </h3>

                <p>
                  Choose either a percentage
                  of the tax base or one fixed
                  amount.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Calculation method
                  <strong>*</strong>
                </span>

                <select
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values
                      .calculationMethod
                  }
                  onChange={(event) =>
                    handleMethodChange(
                      event.target
                        .value as
                        TaxCalculationMethod,
                    )
                  }
                >
                  {TAX_CALCULATION_METHOD_OPTIONS.map(
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

              {values.calculationMethod ===
              "percentage" ? (
                <label className="form-field">
                  <span>
                    Percentage rate
                    <strong>*</strong>
                  </span>

                  <input
                    required
                    type="number"
                    min={0}
                    max={100}
                    step="0.000001"
                    disabled={
                      coreFieldsAreLocked
                    }
                    value={
                      values
                        .ratePercentage
                    }
                    placeholder="25.000000"
                    onChange={(event) =>
                      setField(
                        "ratePercentage",
                        event.target.value,
                      )
                    }
                  />
                </label>
              ) : (
                <label className="form-field">
                  <span>
                    Fixed amount
                    <strong>*</strong>
                  </span>

                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={
                      coreFieldsAreLocked
                    }
                    value={
                      values.fixedAmount
                    }
                    placeholder="750.00"
                    onChange={(event) =>
                      setField(
                        "fixedAmount",
                        event.target.value,
                      )
                    }
                  />
                </label>
              )}
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>03</span>

              <div>
                <h3>
                  Effective period
                </h3>

                <p>
                  Rules with the same code
                  cannot have overlapping
                  effective periods.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Effective from
                  <strong>*</strong>
                </span>

                <input
                  required
                  type="date"
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values.effectiveFrom
                  }
                  onChange={(event) =>
                    setField(
                      "effectiveFrom",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Effective to
                </span>

                <input
                  type="date"
                  disabled={
                    coreFieldsAreLocked
                  }
                  min={
                    values.effectiveFrom
                  }
                  value={
                    values.effectiveTo
                  }
                  onChange={(event) =>
                    setField(
                      "effectiveTo",
                      event.target.value,
                    )
                  }
                />

                <small>
                  Leave blank for an
                  open-ended rule.
                </small>
              </label>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>04</span>

              <div>
                <h3>
                  Applicability
                </h3>

                <p>
                  Record who or what activity
                  the rule applies to.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Taxpayer category
                </span>

                <input
                  maxLength={120}
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values
                      .taxpayerCategory
                  }
                  placeholder="Example: Resident company"
                  onChange={(event) =>
                    setField(
                      "taxpayerCategory",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Business activity
                </span>

                <input
                  maxLength={120}
                  disabled={
                    coreFieldsAreLocked
                  }
                  value={
                    values
                      .businessActivity
                  }
                  placeholder="Example: General trading"
                  onChange={(event) =>
                    setField(
                      "businessActivity",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>05</span>

              <div>
                <h3>
                  Audit information
                </h3>

                <p>
                  Identify where the rule came
                  from and record explanatory
                  notes.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field form-field--full">
                <span>
                  Source reference
                </span>

                <textarea
                  rows={3}
                  maxLength={20000}
                  value={
                    values
                      .sourceReference
                  }
                  placeholder="Example: legislation, tax authority notice or professional advice"
                  onChange={(event) =>
                    setField(
                      "sourceReference",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Notes
                </span>

                <textarea
                  rows={4}
                  maxLength={20000}
                  value={
                    values.notes
                  }
                  placeholder="Additional explanation about how or when this rule should be used"
                  onChange={(event) =>
                    setField(
                      "notes",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
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
                ? "Saving rule..."
                : isEditing
                  ? "Save tax rule"
                  : "Create tax rule"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}