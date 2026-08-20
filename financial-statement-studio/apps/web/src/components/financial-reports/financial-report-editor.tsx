"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createFinancialReport,
  updateFinancialReport,
} from "@/lib/financial-reports-api";
import {
  BUSINESS_TYPE_OPTIONS,
  type BusinessType,
  type Company,
} from "@/types/company";
import {
  REPORT_TYPE_OPTIONS,
  type FinancialReport,
  type FinancialReportCreatePayload,
  type ReportType,
} from "@/types/financial-report";

type FinancialReportEditorProps = {
  companies: Company[];
  reports: FinancialReport[];
  report: FinancialReport | null;
  initialCompanyId?: string;
  onClose: () => void;
  onSaved: (
    report: FinancialReport,
  ) => Promise<void> | void;
};

type ReportFormValues = {
  companyId: string;
  title: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  currency: string;
  businessTemplate: BusinessType;
  comparisonReportId: string;

  accountantName: string;
  accountantFirmName: string;
  accountantProfessionalDesignation: string;
  accountantFirmAddress: string;

  accountantReportText: string;
};

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getDefaultDates(): {
  periodStart: string;
  periodEnd: string;
} {
  const year = getCurrentYear();

  return {
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
  };
}

function getCompanyById(
  companies: Company[],
  companyId: string,
): Company | null {
  return (
    companies.find(
      (company) =>
        company.id === companyId,
    ) ?? null
  );
}

function getInitialValues(
  companies: Company[],
  report: FinancialReport | null,
  initialCompanyId?: string,
): ReportFormValues {
  if (report) {
    return {
      companyId: report.company_id,
      title: report.title,
      reportType: report.report_type,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      currency: report.currency,
      businessTemplate:
        report.business_template,
      comparisonReportId:
        report.comparison_report_id ?? "",

      accountantName:
        report.accountant_name ?? "",

      accountantFirmName:
        report.accountant_firm_name ?? "",

      accountantProfessionalDesignation:
        report
          .accountant_professional_designation ??
        "",

      accountantFirmAddress:
        report.accountant_firm_address ?? "",

      accountantReportText:
        report.accountant_report_text ?? "",
    };
  }

  const preferredCompany =
    getCompanyById(
      companies,
      initialCompanyId ?? "",
    ) ?? companies[0] ?? null;

  const dates = getDefaultDates();

  return {
    companyId:
      preferredCompany?.id ?? "",
    title: "",
    reportType:
      "annual_financial_statements",
    periodStart: dates.periodStart,
    periodEnd: dates.periodEnd,
    currency:
      preferredCompany
        ?.default_currency ?? "GHS",
    businessTemplate:
      preferredCompany
        ?.business_type ?? "other",
    comparisonReportId: "",

    accountantName: "",
    accountantFirmName: "",
    accountantProfessionalDesignation: "",
    accountantFirmAddress: "",

    accountantReportText: "",
  };
}

function nullableText(
  value: string,
): string | null {
  const cleanedValue = value.trim();

  return cleanedValue || null;
}

function isEarlierPeriod(
  reportEnd: string,
  currentEnd: string,
): boolean {
  return (
    new Date(
      `${reportEnd}T00:00:00`,
    ).getTime() <
    new Date(
      `${currentEnd}T00:00:00`,
    ).getTime()
  );
}

export function FinancialReportEditor({
  companies,
  reports,
  report,
  initialCompanyId,
  onClose,
  onSaved,
}: FinancialReportEditorProps) {
  const [values, setValues] =
    useState<ReportFormValues>(() =>
      getInitialValues(
        companies,
        report,
        initialCompanyId,
      ),
    );

  const [formError, setFormError] =
    useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const isEditing = report !== null;

  const selectedCompany =
    getCompanyById(
      companies,
      values.companyId,
    );

  const comparisonOptions =
    useMemo(() => {
      return reports.filter(
        (candidate) =>
          candidate.company_id ===
            values.companyId &&
          candidate.id !== report?.id &&
          isEarlierPeriod(
            candidate.period_end,
            values.periodEnd,
          ),
      );
    }, [
      report?.id,
      reports,
      values.companyId,
      values.periodEnd,
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
    FieldName extends keyof ReportFormValues,
  >(
    fieldName: FieldName,
    value: ReportFormValues[FieldName],
  ): void {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  }

  function handleCompanyChange(
    companyId: string,
  ): void {
    const company =
      getCompanyById(
        companies,
        companyId,
      );

    setValues((currentValues) => ({
      ...currentValues,
      companyId,
      currency:
        company?.default_currency ??
        currentValues.currency,
      businessTemplate:
        company?.business_type ??
        currentValues.businessTemplate,
      comparisonReportId: "",
    }));
  }

  function handlePeriodEndChange(
    periodEnd: string,
  ): void {
    setValues((currentValues) => {
      const selectedComparison =
        reports.find(
          (candidate) =>
            candidate.id ===
            currentValues.comparisonReportId,
        );

      const comparisonStillValid =
        selectedComparison
          ? isEarlierPeriod(
              selectedComparison.period_end,
              periodEnd,
            )
          : true;

      return {
        ...currentValues,
        periodEnd,
        comparisonReportId:
          comparisonStillValid
            ? currentValues.comparisonReportId
            : "",
      };
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError(null);

    if (!values.companyId) {
      setFormError(
        "Select the company that owns this financial report.",
      );
      return;
    }

    if (
      !values.periodStart ||
      !values.periodEnd
    ) {
      setFormError(
        "Enter both the reporting start date and end date.",
      );
      return;
    }

    if (
      values.periodEnd <
      values.periodStart
    ) {
      setFormError(
        "The reporting end date cannot be before the start date.",
      );
      return;
    }

    const currency =
      values.currency
        .trim()
        .toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      setFormError(
        "Currency must be a three-letter code such as GHS or USD.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const sharedPayload = {
        title: nullableText(
          values.title,
        ),
        report_type:
          values.reportType,
        period_start:
          values.periodStart,
        period_end:
          values.periodEnd,
        currency,
        business_template:
          values.businessTemplate,
        comparison_report_id:
          nullableText(
            values.comparisonReportId,
          ),
         accountant_name:
          nullableText(
            values.accountantName,
          ),

        accountant_firm_name:
          nullableText(
            values.accountantFirmName,
          ),

        accountant_professional_designation:
          nullableText(
            values
              .accountantProfessionalDesignation,
          ),

        accountant_firm_address:
          nullableText(
            values.accountantFirmAddress,
          ),

        accountant_report_text:
          nullableText(
            values.accountantReportText,
          ),
      };

      const savedReport = isEditing
        ? await updateFinancialReport(
            report.id,
            sharedPayload,
          )
        : await createFinancialReport({
            ...sharedPayload,
            company_id:
              values.companyId,
          } satisfies FinancialReportCreatePayload);

      await onSaved(savedReport);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The financial report could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="report-editor-backdrop"
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
        className="report-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-editor-title"
      >
        <header className="report-editor__header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? "Report settings"
                : "New financial document"}
            </p>

            <h2 id="report-editor-title">
              {isEditing
                ? "Edit report setup"
                : "Create financial report"}
            </h2>

            <p>
              Select the business, reporting
              period, document type and
              accounting template.
            </p>
          </div>

          <button
            className="report-editor__close"
            type="button"
            aria-label="Close report form"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="report-form"
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

          <section className="report-form__section">
            <div className="report-form__section-heading">
              <span>01</span>

              <div>
                <h3>
                  Company and report type
                </h3>

                <p>
                  The company determines
                  the default currency and
                  business template.
                </p>
              </div>
            </div>

            <div className="report-form__grid">
              <label className="form-field form-field--full">
                <span>
                  Company
                  <strong>*</strong>
                </span>

                <select
                  required
                  disabled={isEditing}
                  value={values.companyId}
                  onChange={(event) =>
                    handleCompanyChange(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select a company
                  </option>

                  {companies.map(
                    (company) => (
                      <option
                        value={company.id}
                        key={company.id}
                      >
                        {company.name}
                      </option>
                    ),
                  )}
                </select>

                {isEditing ? (
                  <small>
                    A report cannot be moved
                    to another company after
                    it has been created.
                  </small>
                ) : null}
              </label>

              <label className="form-field">
                <span>
                  Report type
                  <strong>*</strong>
                </span>

                <select
                  value={values.reportType}
                  onChange={(event) =>
                    setField(
                      "reportType",
                      event.target
                        .value as ReportType,
                    )
                  }
                >
                  {REPORT_TYPE_OPTIONS.map(
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
                  Currency
                  <strong>*</strong>
                </span>

                <input
                  required
                  minLength={3}
                  maxLength={3}
                  value={values.currency}
                  placeholder="GHS"
                  onChange={(event) =>
                    setField(
                      "currency",
                      event.target.value
                        .toUpperCase(),
                    )
                  }
                />

                <small>
                  Company default:{" "}
                  {selectedCompany
                    ?.default_currency ??
                    "Not available"}
                </small>
              </label>

              <label className="form-field form-field--full">
                <span>
                  Custom report title
                </span>

                <input
                  maxLength={255}
                  value={values.title}
                  placeholder="Leave blank to generate the title automatically"
                  onChange={(event) =>
                    setField(
                      "title",
                      event.target.value,
                    )
                  }
                />

                <small>
                  The system will generate a
                  professional title when this
                  field is blank.
                </small>
              </label>
            </div>
          </section>

          <section className="report-form__section">
            <div className="report-form__section-heading">
              <span>02</span>

              <div>
                <h3>
                  Reporting period
                </h3>

                <p>
                  This determines the
                  financial year and report
                  date headings.
                </p>
              </div>
            </div>

            <div className="report-form__grid">
              <label className="form-field">
                <span>
                  Period start
                  <strong>*</strong>
                </span>

                <input
                  required
                  type="date"
                  value={values.periodStart}
                  onChange={(event) =>
                    setField(
                      "periodStart",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Period end
                  <strong>*</strong>
                </span>

                <input
                  required
                  type="date"
                  value={values.periodEnd}
                  onChange={(event) =>
                    handlePeriodEndChange(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Business template
                  <strong>*</strong>
                </span>

                <select
                  value={
                    values.businessTemplate
                  }
                  onChange={(event) =>
                    setField(
                      "businessTemplate",
                      event.target
                        .value as BusinessType,
                    )
                  }
                >
                  {BUSINESS_TYPE_OPTIONS.map(
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
                  This controls the default
                  income, expense and account
                  categories.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Comparative report
                </span>

                <select
                  value={
                    values.comparisonReportId
                  }
                  onChange={(event) =>
                    setField(
                      "comparisonReportId",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    No comparative report
                  </option>

                  {comparisonOptions.map(
                    (candidate) => (
                      <option
                        value={candidate.id}
                        key={candidate.id}
                      >
                        {candidate.title}
                      </option>
                    ),
                  )}
                </select>

                <small>
                  Only earlier reports from
                  the selected company are
                  available.
                </small>
              </label>
            </div>
          </section>

                    <section className="report-form__section">
            <div className="report-form__section-heading">
              <span>03</span>

              <div>
                <h3>
                  Professional adviser
                </h3>

                <p>
                  These details appear in
                  the professional advisers
                  and accountant&apos;s report
                  sections of the complete
                  financial statements.
                </p>
              </div>
            </div>

            <div className="report-form__grid">
              <label className="form-field">
                <span>
                  Accountant or preparer
                  name
                </span>

                <input
                  maxLength={180}
                  value={
                    values.accountantName
                  }
                  placeholder="Example: John Mensah"
                  onChange={(event) =>
                    setField(
                      "accountantName",
                      event.target.value,
                    )
                  }
                />

                <small>
                  The individual responsible
                  for preparing or certifying
                  the financial statements.
                </small>
              </label>

              <label className="form-field">
                <span>
                  Accounting firm
                </span>

                <input
                  maxLength={180}
                  value={
                    values.accountantFirmName
                  }
                  placeholder="Example: ABC Consultancy Services"
                  onChange={(event) =>
                    setField(
                      "accountantFirmName",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>
                  Professional designation
                </span>

                <input
                  maxLength={180}
                  value={
                    values
                      .accountantProfessionalDesignation
                  }
                  placeholder="Example: Chartered Accountants"
                  onChange={(event) =>
                    setField(
                      "accountantProfessionalDesignation",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="form-field form-field--full">
                <span>
                  Accounting firm address
                </span>

                <textarea
                  rows={4}
                  maxLength={2000}
                  value={
                    values
                      .accountantFirmAddress
                  }
                  placeholder="Postal or office address of the accountant or accounting firm"
                  onChange={(event) =>
                    setField(
                      "accountantFirmAddress",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="report-form__section">
            <div className="report-form__section-heading">
              <span>04</span>

              <div>
                <h3>
                  Accountant&apos;s report
                </h3>

                <p>
                  Enter the preparation,
                  certification or accountant
                  report wording that should
                  appear in the complete
                  financial statements.
                </p>
              </div>
            </div>

            <label className="form-field">
              <span>
                Accountant&apos;s report or
                certification text
              </span>

              <textarea
                rows={10}
                maxLength={20000}
                value={
                  values.accountantReportText
                }
                placeholder="Enter the accountant's report or certification wording"
                onChange={(event) =>
                  setField(
                    "accountantReportText",
                    event.target.value,
                  )
                }
              />

              <small>
                This information is stored
                with the financial report,
                so different reporting years
                may use different accountants
                or wording.
              </small>
            </label>
          </section>

          <footer className="report-form__footer">
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
                companies.length === 0
              }
            >
              {isSubmitting
                ? "Saving report..."
                : isEditing
                  ? "Save report setup"
                  : "Create financial report"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}