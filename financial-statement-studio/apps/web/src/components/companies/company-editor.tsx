"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createCompany,
  updateCompany,
} from "@/lib/companies-api";
import {
  BUSINESS_TYPE_OPTIONS,
  REPORTING_BASIS_OPTIONS,
  type BusinessType,
  type Company,
  type CompanyCreatePayload,
  type ReportingBasis,
} from "@/types/company";

type CompanyEditorProps = {
  company: Company | null;
  onClose: () => void;
  onSaved: (
    company: Company,
  ) => Promise<void> | void;
};

type CompanyFormValues = {
  name: string;
  businessType: BusinessType;
  registrationNumber: string;
  tin: string;
  ghanaCardNumber: string;
  address: string;
  telephone: string;
  email: string;
  defaultCurrency: string;
  reportingBasis: ReportingBasis;
};

function getInitialValues(
  company: Company | null,
): CompanyFormValues {
  return {
    name: company?.name ?? "",
    businessType:
      company?.business_type ??
      "other",
    registrationNumber:
      company?.registration_number ??
      "",
    tin: company?.tin ?? "",
    ghanaCardNumber:
      company?.ghana_card_number ??
      "",
    address: company?.address ?? "",
    telephone:
      company?.telephone ?? "",
    email: company?.email ?? "",
    defaultCurrency:
      company?.default_currency ??
      "GHS",
    reportingBasis:
      company?.reporting_basis ??
      "accrual",
  };
}

function nullableText(
  value: string,
): string | null {
  const cleanedValue = value.trim();

  return cleanedValue || null;
}

export function CompanyEditor({
  company,
  onClose,
  onSaved,
}: CompanyEditorProps) {
  const [values, setValues] =
    useState<CompanyFormValues>(
      () => getInitialValues(company),
    );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  const isEditing = company !== null;

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
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
  }, [isSubmitting, onClose]);

  function setField<
    FieldName extends keyof CompanyFormValues,
  >(
    fieldName: FieldName,
    value: CompanyFormValues[FieldName],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError(null);

    const companyName =
      values.name.trim();

    if (companyName.length < 2) {
      setFormError(
        "Enter a company name containing at least two characters.",
      );
      return;
    }

    const currency =
      values.defaultCurrency
        .trim()
        .toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      setFormError(
        "Currency must be a three-letter code such as GHS or USD.",
      );
      return;
    }

    const payload: CompanyCreatePayload = {
      name: companyName,
      business_type:
        values.businessType,
      registration_number:
        nullableText(
          values.registrationNumber,
        ),
      tin: nullableText(values.tin),
      ghana_card_number:
        nullableText(
          values.ghanaCardNumber,
        ),
      address: nullableText(
        values.address,
      ),
      telephone: nullableText(
        values.telephone,
      ),
      email: nullableText(
        values.email,
      ),
      default_currency: currency,
      reporting_basis:
        values.reportingBasis,
    };

    setIsSubmitting(true);

    try {
      const savedCompany = isEditing
        ? await updateCompany(
            company.id,
            payload,
          )
        : await createCompany(payload);

      await onSaved(savedCompany);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The company could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="company-editor-backdrop"
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
        className="company-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-editor-title"
      >
        <header className="company-editor__header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? "Company settings"
                : "New company"}
            </p>

            <h2 id="company-editor-title">
              {isEditing
                ? "Edit company"
                : "Create a company"}
            </h2>

            <p>
              Add the information that
              should identify this business
              in its financial statements.
            </p>
          </div>

          <button
            className="company-editor__close"
            type="button"
            aria-label="Close company form"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="company-form"
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

          <section className="company-form__section">
            <div className="company-form__section-heading">
              <span>01</span>
              <div>
                <h3>
                  Basic information
                </h3>
                <p>
                  The company name is
                  required. Other fields may
                  be completed later.
                </p>
              </div>
            </div>

            <div className="company-form__grid">
              <label className="form-field form-field--full">
                <span>
                  Company or business name
                  <strong>*</strong>
                </span>

                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={180}
                  value={values.name}
                  placeholder="Example: Elliott Business Solutions"
                  onChange={(event) =>
                    setField(
                      "name",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Business type
                  <strong>*</strong>
                </span>

                <select
                  value={
                    values.businessType
                  }
                  onChange={(event) =>
                    setField(
                      "businessType",
                      event.target
                        .value as BusinessType,
                    )
                  }
                >
                  {BUSINESS_TYPE_OPTIONS.map(
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
              </label>

              <label className="form-field">
                <span>
                  Accounting basis
                  <strong>*</strong>
                </span>

                <select
                  value={
                    values.reportingBasis
                  }
                  onChange={(event) =>
                    setField(
                      "reportingBasis",
                      event.target
                        .value as ReportingBasis,
                    )
                  }
                >
                  {REPORTING_BASIS_OPTIONS.map(
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

                <small>
                  Accrual basis is normally
                  used for formal financial
                  statements.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Default currency
                  <strong>*</strong>
                </span>

                <input
                  required
                  minLength={3}
                  maxLength={3}
                  value={
                    values.defaultCurrency
                  }
                  placeholder="GHS"
                  onChange={(event) =>
                    setField(
                      "defaultCurrency",
                      event.target.value
                        .toUpperCase(),
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Registration number
                </span>

                <input
                  maxLength={100}
                  value={
                    values.registrationNumber
                  }
                  placeholder="Optional"
                  onChange={(event) =>
                    setField(
                      "registrationNumber",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Taxpayer Identification
                  Number
                </span>

                <input
                  maxLength={100}
                  value={values.tin}
                  placeholder="Optional"
                  onChange={(event) =>
                    setField(
                      "tin",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Ghana Card number
                </span>

                <input
                  maxLength={100}
                  value={
                    values.ghanaCardNumber
                  }
                  placeholder="Optional"
                  onChange={(event) =>
                    setField(
                      "ghanaCardNumber",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="company-form__section">
            <div className="company-form__section-heading">
              <span>02</span>
              <div>
                <h3>
                  Address and contact
                </h3>
                <p>
                  These details may appear
                  on cover pages and company
                  information sections.
                </p>
              </div>
            </div>

            <div className="company-form__grid">
              <label className="form-field form-field--full">
                <span>
                  Business address
                </span>

                <textarea
                  rows={4}
                  maxLength={2000}
                  value={values.address}
                  placeholder="Street, area, city and country"
                  onChange={(event) =>
                    setField(
                      "address",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Telephone
                </span>

                <input
                  type="tel"
                  maxLength={50}
                  value={
                    values.telephone
                  }
                  placeholder="+233..."
                  onChange={(event) =>
                    setField(
                      "telephone",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Email address
                </span>

                <input
                  type="email"
                  value={values.email}
                  placeholder="accounts@example.com"
                  onChange={(event) =>
                    setField(
                      "email",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <footer className="company-form__footer">
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
                ? "Saving company..."
                : isEditing
                  ? "Save changes"
                  : "Create company"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}