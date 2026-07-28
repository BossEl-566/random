"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createTaxProfile,
} from "@/lib/tax-configuration-api";
import type {
  Company,
} from "@/types/company";
import type {
  TaxProfile,
  TaxProfileCreatePayload,
} from "@/types/tax-configuration";

type TaxProfileEditorProps = {
  company: Company;
  onClose: () => void;
  onSaved: (
    profile: TaxProfile,
  ) => Promise<void> | void;
};

type TaxProfileFormValues = {
  profileCode: string;
  profileName: string;

  jurisdictionCountryCode: string;
  jurisdictionName: string;

  taxIdentifier: string;
  taxpayerCategory: string;
  description: string;

  isDefault: boolean;
};

const initialValues: TaxProfileFormValues = {
  profileCode: "",
  profileName: "",

  jurisdictionCountryCode: "GH",
  jurisdictionName: "Ghana",

  taxIdentifier: "",
  taxpayerCategory: "",
  description: "",

  isDefault: false,
};

function nullableText(
  value: string,
): string | null {
  const cleanedValue = value.trim();

  return cleanedValue || null;
}

export function TaxProfileEditor({
  company,
  onClose,
  onSaved,
}: TaxProfileEditorProps) {
  const [
    values,
    setValues,
  ] = useState<TaxProfileFormValues>(
    initialValues,
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

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
    FieldName extends keyof TaxProfileFormValues,
  >(
    fieldName: FieldName,
    value: TaxProfileFormValues[FieldName],
  ): void {
    setValues(
      (currentValues) => ({
        ...currentValues,
        [fieldName]: value,
      }),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setFormError(null);

    const profileCode =
      values.profileCode
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "-");

    const profileName =
      values.profileName.trim();

    const jurisdictionCountryCode =
      values.jurisdictionCountryCode
        .trim()
        .toUpperCase();

    const jurisdictionName =
      values.jurisdictionName.trim();

    if (!profileCode) {
      setFormError(
        "Enter a profile code.",
      );
      return;
    }

    if (!profileName) {
      setFormError(
        "Enter a profile name.",
      );
      return;
    }

    if (
      !/^[A-Z]{2}$/.test(
        jurisdictionCountryCode,
      )
    ) {
      setFormError(
        "Jurisdiction country code must contain exactly two letters.",
      );
      return;
    }

    if (!jurisdictionName) {
      setFormError(
        "Enter the jurisdiction name.",
      );
      return;
    }

    const payload:
      TaxProfileCreatePayload = {
        company_id: company.id,

        profile_code: profileCode,
        profile_name: profileName,

        jurisdiction_country_code:
          jurisdictionCountryCode,

        jurisdiction_name:
          jurisdictionName,

        tax_identifier:
          nullableText(
            values.taxIdentifier,
          ),

        taxpayer_category:
          nullableText(
            values.taxpayerCategory,
          ),

        description:
          nullableText(
            values.description,
          ),

        is_default:
          values.isDefault,

        is_active: true,
      };

    setIsSubmitting(true);

    try {
      const profile =
        await createTaxProfile(
          payload,
        );

      await onSaved(profile);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The tax profile could not be created.",
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
        aria-labelledby="tax-profile-editor-title"
      >
        <header className="ledger-editor__header">
          <div>
            <p className="eyebrow">
              Company tax settings
            </p>

            <h2 id="tax-profile-editor-title">
              Add Tax Profile
            </h2>

            <p>
              A tax profile groups the tax
              rules that apply to a particular
              taxpayer, jurisdiction or
              business category.
            </p>
          </div>

          <button
            className="ledger-editor__close"
            type="button"
            aria-label="Close tax profile form"
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

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>01</span>

              <div>
                <h3>
                  Profile identity
                </h3>

                <p>
                  The profile code and name
                  must be unique within{" "}
                  {company.name}.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Profile code
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={60}
                  value={
                    values.profileCode
                  }
                  placeholder="Example: GH-CIT"
                  onChange={(event) =>
                    setField(
                      "profileCode",
                      event.target.value
                        .toUpperCase(),
                    )
                  }
                />

                <small>
                  Spaces will be converted
                  to hyphens.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Profile name
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={180}
                  value={
                    values.profileName
                  }
                  placeholder="Example: Ghana Corporate Income Tax"
                  onChange={(event) =>
                    setField(
                      "profileName",
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
                  maxLength={20000}
                  value={
                    values.description
                  }
                  placeholder="Explain which reports, taxpayers or activities should use this profile"
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
                  Tax jurisdiction
                </h3>

                <p>
                  The jurisdiction identifies
                  the country or authority
                  whose tax rules apply.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Country code
                  <strong>*</strong>
                </span>

                <input
                  required
                  minLength={2}
                  maxLength={2}
                  value={
                    values
                      .jurisdictionCountryCode
                  }
                  placeholder="GH"
                  onChange={(event) =>
                    setField(
                      "jurisdictionCountryCode",
                      event.target.value
                        .toUpperCase(),
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Jurisdiction name
                  <strong>*</strong>
                </span>

                <input
                  required
                  maxLength={120}
                  value={
                    values.jurisdictionName
                  }
                  placeholder="Ghana"
                  onChange={(event) =>
                    setField(
                      "jurisdictionName",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="ledger-form__section">
            <div className="ledger-form__section-heading">
              <span>03</span>

              <div>
                <h3>
                  Taxpayer details
                </h3>

                <p>
                  These fields are optional
                  and may be completed when
                  the information is available.
                </p>
              </div>
            </div>

            <div className="ledger-form__grid">
              <label className="form-field">
                <span>
                  Tax identifier
                </span>

                <input
                  maxLength={120}
                  value={
                    values.taxIdentifier
                  }
                  placeholder="Example: Company TIN"
                  onChange={(event) =>
                    setField(
                      "taxIdentifier",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Taxpayer category
                </span>

                <input
                  maxLength={120}
                  value={
                    values.taxpayerCategory
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

              <label className="form-field form-field--full">
                <span>
                  <input
                    type="checkbox"
                    checked={
                      values.isDefault
                    }
                    onChange={(event) =>
                      setField(
                        "isDefault",
                        event.target.checked,
                      )
                    }
                  />

                  {" "}
                  Make this the company’s
                  default tax profile
                </span>

                <small>
                  The first profile created
                  for a company becomes the
                  default automatically.
                </small>
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
                ? "Creating profile..."
                : "Create tax profile"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}