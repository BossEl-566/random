"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { StatementSection } from "@/components/financial-statements/statement-section";
import {
  formatStatementMoney,
  toNumber,
} from "@/components/financial-statements/statement-utils";

import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  getProfitOrLossStatement,
  getStatementOfFinancialPosition,
} from "@/lib/financial-statements-api";

import type {
  Company,
} from "@/types/company";

import type {
  FinancialReport,
} from "@/types/financial-report";

import type {
  FinancialStatementSection,
  ProfitOrLossStatement,
  StatementOfFinancialPosition,
} from "@/types/financial-statement";
import { EquityAccountTable } from "@/components/financial-statements/equity-account-table";
import { EquityMovementSection } from "@/components/financial-statements/equity-movement-section";
import {
  getStatementOfChangesInEquity,
} from "@/lib/equity-statements-api";
import type {
  StatementOfChangesInEquity,
} from "@/types/equity-statement";
import { CashFlowSection } from "@/components/financial-statements/cash-flow-section";
import {
  getCashFlowReadiness,
  getStatementOfCashFlows,
} from "@/lib/cash-flow-api";
import type {
  CashFlowReadiness,
  CashFlowStatementSection,
  StatementOfCashFlows,
} from "@/types/cash-flow";
import {
  listFinancialReportNotes,
} from "@/lib/notes-api";
import {
  NOTE_TYPE_LABELS,
  STATEMENT_NAME_LABELS,
  type FinancialReportNote,
} from "@/types/notes";
import {
  getTaxReconciliation,
  listTaxProfiles,
} from "@/lib/tax-configuration-api";
import type {
  TaxCalculation,
  TaxProfile,
  TaxReconciliation,
} from "@/types/tax-configuration";
import { StatementPrintActions } from "@/components/financial-statements/statement-print-actions";

type CompleteReportWorkspaceProps = {
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
    "en-GH",
    {
      dateStyle: "long",
    },
  ).format(date);
}

function formatStatus(
  value: string,
): string {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function getPrincipalLabel(
  company: Company,
): string {
  return (
    company.principal_title?.trim() ||
    "Principal / Management"
  );
}

function getAccountantDisplayName(
  report: FinancialReport,
): string {
  return (
    report.accountant_name?.trim() ||
    "Not provided"
  );
}

function formatTaxMethod(
  calculation: TaxCalculation,
): string {
  if (
    calculation
      .calculation_method_snapshot ===
    "percentage"
  ) {
    if (
      calculation.rate_applied ===
      null
    ) {
      return "Percentage";
    }

    return `${Number(
      calculation.rate_applied,
    ).toFixed(2)}%`;
  }

  if (
    calculation.fixed_amount_applied ===
    null
  ) {
    return "Fixed amount";
  }

  return `${calculation.currency} ${formatStatementMoney(
    calculation.fixed_amount_applied,
  )}`;
}

function getFirmDisplayName(
  report: FinancialReport,
): string {
  return (
    report.accountant_firm_name?.trim() ||
    "Not provided"
  );
}

const COMPLETE_REPORT_CONTENTS = [
  {
    number: "01",
    key: "business-information",
    title: "Business Information",
  },
  {
    number: "02",
    key: "professional-advisers",
    title: "Professional Advisers",
  },
  {
    number: "03",
    key: "accountant-report",
    title: "Accountant Report",
  },
  {
    number: "04",
    key: "profit-or-loss",
    title: "Statement of Profit or Loss",
  },
  {
    number: "05",
    key: "financial-position",
    title: "Statement of Financial Position",
  },
  {
    number: "06",
    key: "changes-in-equity",
    title: "Statement of Changes in Equity",
  },
  {
    number: "07",
    key: "cash-flows",
    title: "Statement of Cash Flows",
  },
  {
    number: "08",
    key: "notes",
    title: "Notes to the Financial Statements",
  },
  {
    number: "09",
    key: "supporting-schedules",
    title: "Supporting Schedules",
  },
  {
    number: "10",
    key: "tax-computation",
    title: "Tax Computation and Reconciliation",
  },
] as const;

export function CompleteReportWorkspace({
  reportId,
}: CompleteReportWorkspaceProps) {
  const [
    report,
    setReport,
  ] =
    useState<FinancialReport | null>(
      null,
    );

  const [
    company,
    setCompany,
  ] =
    useState<Company | null>(
      null,
    );

    const [
    profitOrLoss,
    setProfitOrLoss,
  ] =
    useState<ProfitOrLossStatement | null>(
      null,
    );

      const [
    financialPosition,
    setFinancialPosition,
  ] =
    useState<StatementOfFinancialPosition | null>(
      null,
    );
      const [
    changesInEquity,
    setChangesInEquity,
  ] =
    useState<StatementOfChangesInEquity | null>(
      null,
    );

      const [
    cashFlowReadiness,
    setCashFlowReadiness,
  ] =
    useState<CashFlowReadiness | null>(
      null,
    );

  const [
    cashFlow,
    setCashFlow,
  ] =
    useState<StatementOfCashFlows | null>(
      null,
    );
    const [
    notes,
    setNotes,
  ] =
    useState<FinancialReportNote[]>(
      [],
    );
  const [
    taxProfiles,
    setTaxProfiles,
  ] =
    useState<TaxProfile[]>(
      [],
    );

  const [
    taxReconciliation,
    setTaxReconciliation,
  ] =
    useState<TaxReconciliation | null>(
      null,
    );
  const [
    resourceState,
    setResourceState,
  ] =
    useState<ResourceState>(
      "loading",
    );

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getFinancialReport(
      reportId,
    )
      .then(
        async (
          reportResponse,
        ) => {
          const [
            companyResponse,
            profitOrLossResponse,
            financialPositionResponse,
            changesInEquityResponse,
            cashFlowReadinessResponse,
            notesResponse,
            taxProfilesResponse,
            taxReconciliationResponse,
          ] = await Promise.all([
            getCompany(
              reportResponse.company_id,
            ),

            getProfitOrLossStatement(
              reportId,
            ),

            getStatementOfFinancialPosition(
              reportId,
            ),

            getStatementOfChangesInEquity(
              reportId,
            ),

            getCashFlowReadiness(
              reportId,
            ),
            listFinancialReportNotes(
              reportId,
              false,
            ),
                        listTaxProfiles(
              reportResponse.company_id,
              true,
            ),

            getTaxReconciliation(
              reportId,
            ),
          ]);

          const cashFlowResponse =
            cashFlowReadinessResponse.is_ready
              ? await getStatementOfCashFlows(
                  reportId,
                )
              : null;

          return {
            reportResponse,
            companyResponse,
            profitOrLossResponse,
            financialPositionResponse,
            changesInEquityResponse,
            cashFlowReadinessResponse,
            cashFlowResponse,
            notesResponse,
            taxProfilesResponse,
            taxReconciliationResponse,
          };
        },
      )
      .then(
        ({
          reportResponse,
          companyResponse,
          profitOrLossResponse,
          financialPositionResponse,
          changesInEquityResponse,
          cashFlowReadinessResponse,
          cashFlowResponse,
          notesResponse,
          taxProfilesResponse,
          taxReconciliationResponse,
        }) => {
          if (cancelled) {
            return;
          }

          setReport(
            reportResponse,
          );

          setCompany(
            companyResponse,
          );
         setProfitOrLoss(
            profitOrLossResponse,
          );
          setFinancialPosition(
            financialPositionResponse,
          );
          setChangesInEquity(
            changesInEquityResponse,
          );
          setCashFlowReadiness(
            cashFlowReadinessResponse,
          );

          setCashFlow(
            cashFlowResponse,
          );
          setNotes(
            notesResponse.items,
          );
                    setTaxProfiles(
            taxProfilesResponse.items,
          );

          setTaxReconciliation(
            taxReconciliationResponse,
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
              "The complete financial statements preview could not be loaded.",
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
    reloadVersion,
    reportId,
  ]);

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
    const profitOrLossSectionMap =
    useMemo(() => {
      return new Map<
        string,
        FinancialStatementSection
      >(
        profitOrLoss?.sections.map(
          (section) => [
            section.key,
            section,
          ],
        ) ?? [],
      );
    }, [profitOrLoss]);

  const directCostSections = [
    profitOrLossSectionMap.get(
      "cost_of_sales",
    ),
    profitOrLossSectionMap.get(
      "direct_service_costs",
    ),
    profitOrLossSectionMap.get(
      "manufacturing_costs",
    ),
  ].filter(
    (
      section,
    ): section is FinancialStatementSection =>
      section !== undefined,
  );

    const financialPositionSectionMap =
    useMemo(() => {
      return new Map<
        string,
        FinancialStatementSection
      >(
        financialPosition?.sections.map(
          (section) => [
            section.key,
            section,
          ],
        ) ?? [],
      );
    }, [financialPosition]);
      const closingCashSection:
    CashFlowStatementSection | null =
    cashFlow
      ? {
          key: "cash_accounts",
          title:
            "Cash and Cash Equivalents at Period End",
          items:
            cashFlow.cash_accounts,
          total:
            cashFlow.closing_cash_balance,
        }
      : null;

    const activeNotes =
    useMemo(
      () =>
        notes
          .filter(
            (note) =>
              note.is_active,
          )
          .sort(
            (
              firstNote,
              secondNote,
            ) =>
              firstNote.note_number -
              secondNote.note_number,
          ),
      [notes],
    );
      const supportingSchedules =
    useMemo(
      () => {
        const candidates = [
          financialPositionSectionMap.get(
            "non_current_assets",
          ),

          financialPositionSectionMap.get(
            "current_assets",
          ),

          financialPositionSectionMap.get(
            "current_liabilities",
          ),

          financialPositionSectionMap.get(
            "non_current_liabilities",
          ),

          profitOrLossSectionMap.get(
            "cost_of_sales",
          ),

          profitOrLossSectionMap.get(
            "direct_service_costs",
          ),

          profitOrLossSectionMap.get(
            "manufacturing_costs",
          ),

          profitOrLossSectionMap.get(
            "administrative_expenses",
          ),

          profitOrLossSectionMap.get(
            "selling_distribution_expenses",
          ),

          profitOrLossSectionMap.get(
            "finance_costs",
          ),
        ];

        return candidates.filter(
          (
            section,
          ): section is FinancialStatementSection =>
            section !== undefined &&
            section.items.length > 0,
        );
      },
      [
        financialPositionSectionMap,
        profitOrLossSectionMap,
      ],
    );
      const primaryTaxProfile =
    useMemo(
      () =>
        taxProfiles.find(
          (profile) =>
            profile.is_default,
        ) ??
        taxProfiles.find(
          (profile) =>
            profile.is_active,
        ) ??
        taxProfiles[0] ??
        null,
      [taxProfiles],
    );

  const isFinal =
    report
      ? [
          "finalised",
          "printed",
          "archived",
        ].includes(
          report.status,
        )
      : false;

  return (
    <main className="complete-report-page">
      <header className="app-topbar complete-report-screen-only">
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
              Complete Financial Statements
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports/${reportId}`}
          >
            Report overview
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/finalisation`}
          >
            Finalisation
          </Link>
        </div>
      </header>

            <section className="complete-report-toolbar complete-report-screen-only">
        <div>
          <strong>
            Complete Financial Statements
          </strong>

          <span>
            Preview, print or save the
            complete financial statement
            package as one A4 document.
          </span>
        </div>

        <div className="complete-report-toolbar__actions">
          <button
            className="secondary-button"
            type="button"
            disabled={
              resourceState ===
              "loading"
            }
            onClick={requestReload}
          >
            Refresh preview
          </button>

          <StatementPrintActions
            disabled={
              resourceState !==
                "ready" ||
              !report ||
              !company
            }
            documentTitle={`${
              company?.name?.trim() ||
              "Company"
            } — Complete Financial Statements`}
            suggestedFileName={`${
              company?.name?.trim() ||
              "Company"
            } - Complete Financial Statements - ${
              report?.period_end ??
              "report"
            }.pdf`}
          />
        </div>
      </section>

      {resourceState ===
      "loading" ? (
        <section className="complete-report-loading complete-report-screen-only">
          <div />
          <div />
          <div />
          <div />
        </section>
      ) : null}

      {resourceState ===
      "error" ? (
        <section className="journal-state-card journal-state-card--error complete-report-screen-only">
          <span>
            Preview unavailable
          </span>

          <h2>
            Complete report could not
            be loaded
          </h2>

          <p>{loadError}</p>

          <button
            className="primary-button"
            type="button"
            onClick={requestReload}
          >
            Try again
          </button>
        </section>
      ) : null}

      {resourceState ===
        "ready" &&
      report &&
      company ? (
        <section className="complete-report-document">
          {!isFinal ? (
            <div className="complete-report-draft-banner complete-report-screen-only">
              Draft package preview —
              this report has not yet
              been finalised.
            </div>
          ) : null}

          {/* COVER PAGE */}
          <article className="complete-report-sheet complete-report-cover">
            {!isFinal ? (
              <div
                className="complete-report-watermark"
                aria-hidden="true"
              >
                DRAFT
              </div>
            ) : null}

            <div className="complete-report-cover__top">
              <div className="complete-report-cover__brand">
                <span>
                  Financial Statements
                </span>
              </div>
            </div>

            <div className="complete-report-cover__body">
              <p>
                {company.name}
              </p>

              <h1>
                {report.title}
              </h1>

              <div className="complete-report-cover__rule" />

              <strong>
                For the period ended{" "}
                {formatDate(
                  report.period_end,
                )}
              </strong>

              <span>
                Financial year{" "}
                {report.financial_year}
              </span>
            </div>

            <footer className="complete-report-cover__footer">
              <span>
                {company.address ??
                  "Business address not provided"}
              </span>

              <span>
                Status:{" "}
                {formatStatus(
                  report.status,
                )}
              </span>
            </footer>
          </article>

          {/* CONTENTS PAGE */}
          <article
  className="complete-report-sheet"
  id="complete-report-business-information"
  data-complete-report-section="business-information"
>
            <header className="complete-report-section-header">
              <span>
                Financial Statements
              </span>

              <h1>
                Table of Contents
              </h1>
            </header>

            <div className="complete-report-contents">
  {COMPLETE_REPORT_CONTENTS.map(
    (item) => (
      <a
        className="complete-report-contents__item"
        href={`#complete-report-${item.key}`}
        key={item.key}
      >
        <span className="complete-report-contents__number">
          {item.number}
        </span>

        <strong>
          {item.title}
        </strong>

        <span
          className="complete-report-contents__page"
          data-toc-key={item.key}
          aria-label="PDF page number"
        >
          —
        </span>
      </a>
    ),
  )}
</div>

          </article>

          {/* BUSINESS INFORMATION */}
          <article
  className="complete-report-sheet"
  id="complete-report-business-information"
  data-complete-report-section="business-information"
>
            <header className="complete-report-section-header">
              <span>
                Section 01
              </span>

              <h1>
                Business Information
              </h1>
            </header>

            <div className="complete-report-information-grid">
              <div>
                <span>
                  Business name
                </span>

                <strong>
                  {company.name}
                </strong>
              </div>

              <div>
                <span>
                  Business type
                </span>

                <strong>
                  {formatStatus(
                    company.business_type,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Registration number
                </span>

                <strong>
                  {company.registration_number ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <span>
                  Taxpayer Identification
                  Number
                </span>

                <strong>
                  {company.tin ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <span>
                  Ghana Card number
                </span>

                <strong>
                  {company.ghana_card_number ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <span>
                  Reporting basis
                </span>

                <strong>
                  {formatStatus(
                    company.reporting_basis,
                  )}
                </strong>
              </div>

              <div className="complete-report-information-grid__full">
                <span>
                  Business address
                </span>

                <strong>
                  {company.address ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <span>
                  Telephone
                </span>

                <strong>
                  {company.telephone ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {company.email ??
                    "Not provided"}
                </strong>
              </div>
            </div>

            <section className="complete-report-principal">
              <span>
                {getPrincipalLabel(
                  company,
                )}
              </span>

              <h2>
                {company.principal_name ??
                  "Not provided"}
              </h2>

              <p>
                {company.principal_title ??
                  "Principal or responsible management person not specified."}
              </p>
            </section>
          </article>

          {/* PROFESSIONAL ADVISERS */}
          <article
  className="complete-report-sheet"
  id="complete-report-professional-advisers"
  data-complete-report-section="professional-advisers"
>
            <header className="complete-report-section-header">
              <span>
                Section 02
              </span>

              <h1>
                Professional Advisers
              </h1>
            </header>

            <div className="complete-report-adviser-card">
              <span>
                Accountant / Preparer
              </span>

              <h2>
                {getAccountantDisplayName(
                  report,
                )}
              </h2>

              <p>
                {report
                  .accountant_professional_designation ??
                  "Professional designation not provided"}
              </p>
            </div>

            <div className="complete-report-adviser-card">
              <span>
                Accounting Firm
              </span>

              <h2>
                {getFirmDisplayName(
                  report,
                )}
              </h2>

              <p>
                {report
                  .accountant_firm_address ??
                  "Accounting firm address not provided"}
              </p>
            </div>

            <div className="complete-report-adviser-card">
              <span>
                Responsible Management
              </span>

              <h2>
                {company.principal_name ??
                  "Not provided"}
              </h2>

              <p>
                {company.principal_title ??
                  "Role not provided"}
              </p>
            </div>
          </article>

          {/* ACCOUNTANT REPORT */}
          <article
  className="complete-report-sheet"
  id="complete-report-accountant-report"
  data-complete-report-section="accountant-report"
>
            <header className="complete-report-section-header">
              <span>
                Section 03
              </span>

              <h1>
                Accountant Report
              </h1>
            </header>

            <div className="complete-report-accountant-report">
              {report.accountant_report_text ? (
                report.accountant_report_text
                  .split(/\n{2,}/)
                  .map(
                    (
                      paragraph,
                      index,
                    ) => (
                      <p key={index}>
                        {
                          paragraph
                        }
                      </p>
                    ),
                  )
              ) : (
                <p className="complete-report-empty">
                  No accountant report
                  or certification text has
                  been entered for this
                  financial report.
                </p>
              )}
            </div>

            <div className="complete-report-signature">
              <div>
                <span>
                  Accountant / Preparer
                </span>

                <strong>
                  {getAccountantDisplayName(
                    report,
                  )}
                </strong>

                <small>
                  {report
                    .accountant_professional_designation ??
                    ""}
                </small>
              </div>

              <div>
                <span>
                  Accounting Firm
                </span>

                <strong>
                  {getFirmDisplayName(
                    report,
                  )}
                </strong>
              </div>
            </div>
          </article>
                    {/* STATEMENT OF PROFIT OR LOSS */}
          {profitOrLoss ? (
            <article
  className="complete-report-sheet complete-report-statement-sheet"
  id="complete-report-profit-or-loss"
  data-complete-report-section="profit-or-loss"
>
              <header className="complete-report-section-header complete-report-statement-header">
                <span>
                  Section 04
                </span>

                <h1>
                  Statement of Profit or Loss
                </h1>

                <p>
                  For the period{" "}
                  {formatDate(
                    profitOrLoss.period_start,
                  )}
                  {" to "}
                  {formatDate(
                    profitOrLoss.period_end,
                  )}
                </p>
              </header>

              <div className="complete-report-statement-meta">
                <div>
                  <span>
                    Company
                  </span>

                  <strong>
                    {company.name}
                  </strong>
                </div>

                <div>
                  <span>
                    Currency
                  </span>

                  <strong>
                    {
                      profitOrLoss.currency
                    }
                  </strong>
                </div>
              </div>

              <div className="financial-statement-document__body complete-report-statement-body">
                {profitOrLossSectionMap.get(
                  "revenue",
                ) ? (
                  <StatementSection
                    currency={
                      profitOrLoss.currency
                    }
                    section={
                      profitOrLossSectionMap.get(
                        "revenue",
                      )!
                    }
                  />
                ) : null}

                {directCostSections.map(
                  (section) => (
                    <StatementSection
                      currency={
                        profitOrLoss.currency
                      }
                      hideWhenEmpty
                      section={
                        section
                      }
                      key={
                        section.key
                      }
                    />
                  ),
                )}

                <div className="financial-statement-subtotal financial-statement-subtotal--major">
                  <strong>
                    Gross Profit
                  </strong>

                  <strong>
                    <span>
                      {
                        profitOrLoss.currency
                      }
                    </span>

                    {formatStatementMoney(
                      profitOrLoss
                        .gross_profit,
                    )}
                  </strong>
                </div>

                {profitOrLossSectionMap.get(
                  "other_income",
                ) ? (
                  <StatementSection
                    currency={
                      profitOrLoss.currency
                    }
                    hideWhenEmpty
                    section={
                      profitOrLossSectionMap.get(
                        "other_income",
                      )!
                    }
                  />
                ) : null}

                {profitOrLossSectionMap.get(
                  "administrative_expenses",
                ) ? (
                  <StatementSection
                    currency={
                      profitOrLoss.currency
                    }
                    hideWhenEmpty
                    section={
                      profitOrLossSectionMap.get(
                        "administrative_expenses",
                      )!
                    }
                  />
                ) : null}

                {profitOrLossSectionMap.get(
                  "selling_distribution_expenses",
                ) ? (
                  <StatementSection
                    currency={
                      profitOrLoss.currency
                    }
                    hideWhenEmpty
                    section={
                      profitOrLossSectionMap.get(
                        "selling_distribution_expenses",
                      )!
                    }
                  />
                ) : null}

                <div className="financial-statement-subtotal">
                  <strong>
                    Operating Profit
                  </strong>

                  <strong>
                    <span>
                      {
                        profitOrLoss.currency
                      }
                    </span>

                    {formatStatementMoney(
                      profitOrLoss
                        .operating_profit,
                    )}
                  </strong>
                </div>

                {profitOrLossSectionMap.get(
                  "finance_costs",
                ) ? (
                  <StatementSection
                    currency={
                      profitOrLoss.currency
                    }
                    hideWhenEmpty
                    section={
                      profitOrLossSectionMap.get(
                        "finance_costs",
                      )!
                    }
                  />
                ) : null}

                <div className="financial-statement-subtotal">
                  <strong>
                    Profit Before Tax
                  </strong>

                  <strong>
                    <span>
                      {
                        profitOrLoss.currency
                      }
                    </span>

                    {formatStatementMoney(
                      profitOrLoss
                        .profit_before_tax,
                    )}
                  </strong>
                </div>

                {profitOrLossSectionMap.get(
                  "taxation",
                ) ? (
                  <StatementSection
                    currency={
                      profitOrLoss.currency
                    }
                    hideWhenEmpty
                    section={
                      profitOrLossSectionMap.get(
                        "taxation",
                      )!
                    }
                  />
                ) : null}

                <div
                  className={
                    toNumber(
                      profitOrLoss
                        .profit_after_tax,
                    ) >= 0
                      ? "financial-statement-final-total financial-statement-final-total--positive"
                      : "financial-statement-final-total financial-statement-final-total--negative"
                  }
                >
                  <div>
                    <span>
                      Result for the period
                    </span>

                    <strong>
                      {toNumber(
                        profitOrLoss
                          .profit_after_tax,
                      ) >= 0
                        ? "Profit After Tax"
                        : "Loss After Tax"}
                    </strong>
                  </div>

                  <strong>
                    <span>
                      {
                        profitOrLoss.currency
                      }
                    </span>

                    {formatStatementMoney(
                      profitOrLoss
                        .profit_after_tax,
                    )}
                  </strong>
                </div>
              </div>

              <footer className="complete-report-statement-footer">
                <span>
                  Prepared from posted,
                  non-voided journal entries.
                </span>

                <span>
                  Financial Statement Studio
                </span>
              </footer>
            </article>
          ) : null}
                    {/* STATEMENT OF FINANCIAL POSITION */}
          {financialPosition ? (
            <article
  className="complete-report-sheet complete-report-statement-sheet"
  id="complete-report-financial-position"
  data-complete-report-section="financial-position"
>
              <header className="complete-report-section-header complete-report-statement-header">
                <span>
                  Section 05
                </span>

                <h1>
                  Statement of Financial Position
                </h1>

                <p>
                  As at{" "}
                  {formatDate(
                    financialPosition.as_of,
                  )}
                </p>
              </header>

              <div className="complete-report-statement-meta">
                <div>
                  <span>
                    Company
                  </span>

                  <strong>
                    {company.name}
                  </strong>
                </div>

                <div>
                  <span>
                    Currency
                  </span>

                  <strong>
                    {
                      financialPosition.currency
                    }
                  </strong>
                </div>
              </div>

              <div className="financial-statement-document__body complete-report-statement-body">
                <div className="financial-position-column-heading">
                  <span>
                    Assets
                  </span>
                </div>

                {financialPositionSectionMap.get(
                  "non_current_assets",
                ) ? (
                  <StatementSection
                    currency={
                      financialPosition.currency
                    }
                    section={
                      financialPositionSectionMap.get(
                        "non_current_assets",
                      )!
                    }
                  />
                ) : null}

                {financialPositionSectionMap.get(
                  "current_assets",
                ) ? (
                  <StatementSection
                    currency={
                      financialPosition.currency
                    }
                    section={
                      financialPositionSectionMap.get(
                        "current_assets",
                      )!
                    }
                  />
                ) : null}

                <div className="financial-statement-final-total">
                  <div>
                    <span>
                      Assets
                    </span>

                    <strong>
                      Total Assets
                    </strong>
                  </div>

                  <strong>
                    <span>
                      {
                        financialPosition.currency
                      }
                    </span>

                    {formatStatementMoney(
                      financialPosition
                        .total_assets,
                    )}
                  </strong>
                </div>

                <div className="financial-position-column-heading">
                  <span>
                    Equity and Liabilities
                  </span>
                </div>

                {financialPositionSectionMap.get(
                  "equity",
                ) ? (
                  <StatementSection
                    currency={
                      financialPosition.currency
                    }
                    section={
                      financialPositionSectionMap.get(
                        "equity",
                      )!
                    }
                  />
                ) : null}

                <div className="financial-statement-subtotal">
                  <strong>
                    Total Equity
                  </strong>

                  <strong>
                    <span>
                      {
                        financialPosition.currency
                      }
                    </span>

                    {formatStatementMoney(
                      financialPosition
                        .total_equity,
                    )}
                  </strong>
                </div>

                {financialPositionSectionMap.get(
                  "non_current_liabilities",
                ) ? (
                  <StatementSection
                    currency={
                      financialPosition.currency
                    }
                    section={
                      financialPositionSectionMap.get(
                        "non_current_liabilities",
                      )!
                    }
                  />
                ) : null}

                {financialPositionSectionMap.get(
                  "current_liabilities",
                ) ? (
                  <StatementSection
                    currency={
                      financialPosition.currency
                    }
                    section={
                      financialPositionSectionMap.get(
                        "current_liabilities",
                      )!
                    }
                  />
                ) : null}

                <div className="financial-statement-subtotal">
                  <strong>
                    Total Liabilities
                  </strong>

                  <strong>
                    <span>
                      {
                        financialPosition.currency
                      }
                    </span>

                    {formatStatementMoney(
                      financialPosition
                        .total_liabilities,
                    )}
                  </strong>
                </div>

                <div className="financial-statement-final-total">
                  <div>
                    <span>
                      Equity and liabilities
                    </span>

                    <strong>
                      Total Equity and Liabilities
                    </strong>
                  </div>

                  <strong>
                    <span>
                      {
                        financialPosition.currency
                      }
                    </span>

                    {formatStatementMoney(
                      financialPosition
                        .total_liabilities_and_equity,
                    )}
                  </strong>
                </div>

                <section
                  className={
                    financialPosition.is_balanced
                      ? "financial-position-validation financial-position-validation--balanced"
                      : "financial-position-validation financial-position-validation--error"
                  }
                >
                  <div>
                    <span>
                      Accounting equation
                    </span>

                    <strong>
                      {financialPosition.is_balanced
                        ? "Assets equal equity and liabilities"
                        : "Statement is out of balance"}
                    </strong>

                    <p>
                      Difference:{" "}
                      {
                        financialPosition.currency
                      }
                      {" "}
                      {formatStatementMoney(
                        financialPosition
                          .accounting_equation_difference,
                      )}
                    </p>
                  </div>

                  <span>
                    {financialPosition.is_balanced
                      ? "Balanced"
                      : "Review required"}
                  </span>
                </section>
              </div>

              <footer className="complete-report-statement-footer">
                <span>
                  Current-year profit is
                  included automatically
                  within equity.
                </span>

                <span>
                  Financial Statement Studio
                </span>
              </footer>
            </article>
          ) : null}
                    {/* STATEMENT OF CHANGES IN EQUITY */}
          {changesInEquity ? (
            <article
  className="complete-report-sheet complete-report-statement-sheet"
  id="complete-report-changes-in-equity"
  data-complete-report-section="changes-in-equity"
>
              <header className="complete-report-section-header complete-report-statement-header">
                <span>
                  Section 06
                </span>

                <h1>
                  Statement of Changes in Equity
                </h1>

                <p>
                  For the period{" "}
                  {formatDate(
                    changesInEquity.period_start,
                  )}
                  {" to "}
                  {formatDate(
                    changesInEquity.period_end,
                  )}
                </p>
              </header>

              <div className="complete-report-statement-meta">
                <div>
                  <span>
                    Company
                  </span>

                  <strong>
                    {company.name}
                  </strong>
                </div>

                <div>
                  <span>
                    Currency
                  </span>

                  <strong>
                    {changesInEquity.currency}
                  </strong>
                </div>
              </div>

              <div className="financial-statement-document__body complete-report-statement-body">
                <div className="financial-position-column-heading">
                  <span>
                    Movement in Recorded Equity
                  </span>
                </div>

                <div className="equity-opening-line">
                  <strong>
                    Opening Recorded Equity
                  </strong>

                  <strong>
                    <span>
                      {changesInEquity.currency}
                    </span>

                    {formatStatementMoney(
                      changesInEquity
                        .opening_recorded_equity,
                    )}
                  </strong>
                </div>

                <EquityMovementSection
                  currency={
                    changesInEquity.currency
                  }
                  section={
                    changesInEquity
                      .direct_increases
                  }
                />

                <EquityMovementSection
                  currency={
                    changesInEquity.currency
                  }
                  section={
                    changesInEquity
                      .direct_decreases
                  }
                />

                <div className="financial-statement-subtotal">
                  <strong>
                    Net Direct Movement in
                    Equity
                  </strong>

                  <strong>
                    <span>
                      {changesInEquity.currency}
                    </span>

                    {formatStatementMoney(
                      changesInEquity
                        .net_direct_equity_movement,
                    )}
                  </strong>
                </div>

                <div className="financial-statement-subtotal financial-statement-subtotal--major">
                  <strong>
                    Recorded Closing Equity
                  </strong>

                  <strong>
                    <span>
                      {changesInEquity.currency}
                    </span>

                    {formatStatementMoney(
                      changesInEquity
                        .recorded_closing_equity,
                    )}
                  </strong>
                </div>

                <div
                  className={
                    toNumber(
                      changesInEquity
                        .profit_after_tax,
                    ) >= 0
                      ? "equity-profit-line equity-profit-line--positive"
                      : "equity-profit-line equity-profit-line--negative"
                  }
                >
                  <div>
                    <span>
                      Financial performance
                    </span>

                    <strong>
                      {toNumber(
                        changesInEquity
                          .profit_after_tax,
                      ) >= 0
                        ? "Profit After Tax"
                        : "Loss After Tax"}
                    </strong>
                  </div>

                  <strong>
                    <span>
                      {changesInEquity.currency}
                    </span>

                    {formatStatementMoney(
                      changesInEquity
                        .profit_after_tax,
                    )}
                  </strong>
                </div>

                <div
                  className={
                    toNumber(
                      changesInEquity
                        .total_closing_equity,
                    ) >= 0
                      ? "financial-statement-final-total financial-statement-final-total--positive"
                      : "financial-statement-final-total financial-statement-final-total--negative"
                  }
                >
                  <div>
                    <span>
                      Closing position
                    </span>

                    <strong>
                      Total Closing Equity
                    </strong>
                  </div>

                  <strong>
                    <span>
                      {changesInEquity.currency}
                    </span>

                    {formatStatementMoney(
                      changesInEquity
                        .total_closing_equity,
                    )}
                  </strong>
                </div>

                <EquityAccountTable
                  statement={
                    changesInEquity
                  }
                />

                <section
                  className={
                    changesInEquity
                      .is_reconciled
                      ? "financial-position-validation financial-position-validation--balanced"
                      : "financial-position-validation financial-position-validation--error"
                  }
                >
                  <div>
                    <span>
                      Equity reconciliation
                    </span>

                    <strong>
                      {changesInEquity
                        .is_reconciled
                        ? "Recorded equity movements reconcile"
                        : "Equity movements require review"}
                    </strong>

                    <p>
                      Difference:{" "}
                      {changesInEquity.currency}
                      {" "}
                      {formatStatementMoney(
                        changesInEquity
                          .equity_reconciliation_difference,
                      )}
                    </p>
                  </div>

                  <span>
                    {changesInEquity
                      .is_reconciled
                      ? "Reconciled"
                      : "Review required"}
                  </span>
                </section>

                <section className="equity-reconciliation-detail">
                  <div>
                    <span>
                      Calculated recorded
                      closing equity
                    </span>

                    <strong>
                      {changesInEquity.currency}
                      {" "}
                      {formatStatementMoney(
                        changesInEquity
                          .calculated_recorded_closing_equity,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Actual recorded
                      closing equity
                    </span>

                    <strong>
                      {changesInEquity.currency}
                      {" "}
                      {formatStatementMoney(
                        changesInEquity
                          .recorded_closing_equity,
                      )}
                    </strong>
                  </div>
                </section>
              </div>

              <footer className="complete-report-statement-footer">
                <span>
                  Prepared from posted,
                  non-voided journal entries.
                  Current-year profit is shown
                  separately from recorded
                  equity.
                </span>

                <span>
                  Financial Statement Studio
                </span>
              </footer>
            </article>
          ) : null}
                    {/* STATEMENT OF CASH FLOWS */}
          {cashFlowReadiness ? (
            <article
  className="complete-report-sheet complete-report-statement-sheet"
  id="complete-report-cash-flows"
  data-complete-report-section="cash-flows"
>
              <header className="complete-report-section-header complete-report-statement-header">
                <span>
                  Section 07
                </span>

                <h1>
                  Statement of Cash Flows
                </h1>

                <p>
                  For the reporting period
                  ended{" "}
                  {formatDate(
                    report.period_end,
                  )}
                </p>
              </header>

              <div className="complete-report-statement-meta">
                <div>
                  <span>
                    Company
                  </span>

                  <strong>
                    {company.name}
                  </strong>
                </div>

                <div>
                  <span>
                    Currency
                  </span>

                  <strong>
                    {cashFlow?.currency ??
                      report.currency}
                  </strong>
                </div>
              </div>

              {!cashFlowReadiness.is_ready ? (
                <section className="complete-report-incomplete-section">
                  <span>
                    Incomplete section
                  </span>

                  <h2>
                    Cash Flow setup is not
                    complete
                  </h2>

                  <p>
                    The Statement of Cash
                    Flows cannot yet be
                    calculated because the
                    required cash-account or
                    cash-flow classifications
                    have not been completed.
                  </p>

                  {cashFlowReadiness.warnings.length >
                  0 ? (
                    <div className="complete-report-incomplete-list">
                      {cashFlowReadiness.warnings.map(
                        (warning) => (
                          <div
                            key={[
                              warning.code,
                              warning
                                .ledger_account_id ??
                                "general",
                            ].join("-")}
                          >
                            <strong>
                              {warning.code
                                .replaceAll(
                                  "_",
                                  " ",
                                )
                                .toLowerCase()}
                            </strong>

                            <p>
                              {
                                warning.message
                              }
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}

                  <p>
                    This section may be
                    completed from the
                    standalone Cash Flows
                    workspace before final
                    printing.
                  </p>
                </section>
              ) : cashFlow ? (
                <div className="financial-statement-document__body complete-report-statement-body">
                  <div className="financial-position-column-heading">
                    <span>
                      Cash Flows from
                      Operating Activities
                    </span>
                  </div>

                  <div className="cash-flow-starting-line">
                    <strong>
                      Profit After Tax
                    </strong>

                    <strong>
                      <span>
                        {
                          cashFlow.currency
                        }
                      </span>

                      {formatStatementMoney(
                        cashFlow
                          .profit_after_tax,
                      )}
                    </strong>
                  </div>

                  <CashFlowSection
                    currency={
                      cashFlow.currency
                    }
                    section={
                      cashFlow
                        .non_cash_adjustments
                    }
                  />

                  <CashFlowSection
                    currency={
                      cashFlow.currency
                    }
                    section={
                      cashFlow
                        .working_capital_adjustments
                    }
                  />

                  <div className="financial-statement-subtotal financial-statement-subtotal--major">
                    <strong>
                      Net Cash from
                      Operating Activities
                    </strong>

                    <strong>
                      <span>
                        {
                          cashFlow.currency
                        }
                      </span>

                      {formatStatementMoney(
                        cashFlow
                          .net_cash_from_operating_activities,
                      )}
                    </strong>
                  </div>

                  <div className="financial-position-column-heading">
                    <span>
                      Cash Flows from
                      Investing Activities
                    </span>
                  </div>

                  <CashFlowSection
                    currency={
                      cashFlow.currency
                    }
                    section={
                      cashFlow
                        .investing_activities
                    }
                  />

                  <div className="financial-statement-subtotal">
                    <strong>
                      Net Cash from
                      Investing Activities
                    </strong>

                    <strong>
                      <span>
                        {
                          cashFlow.currency
                        }
                      </span>

                      {formatStatementMoney(
                        cashFlow
                          .net_cash_from_investing_activities,
                      )}
                    </strong>
                  </div>

                  <div className="financial-position-column-heading">
                    <span>
                      Cash Flows from
                      Financing Activities
                    </span>
                  </div>

                  <CashFlowSection
                    currency={
                      cashFlow.currency
                    }
                    section={
                      cashFlow
                        .financing_activities
                    }
                  />

                  <div className="financial-statement-subtotal">
                    <strong>
                      Net Cash from
                      Financing Activities
                    </strong>

                    <strong>
                      <span>
                        {
                          cashFlow.currency
                        }
                      </span>

                      {formatStatementMoney(
                        cashFlow
                          .net_cash_from_financing_activities,
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      toNumber(
                        cashFlow
                          .net_increase_decrease_in_cash,
                      ) >= 0
                        ? "financial-statement-final-total financial-statement-final-total--positive"
                        : "financial-statement-final-total financial-statement-final-total--negative"
                    }
                  >
                    <div>
                      <span>
                        Net cash movement
                      </span>

                      <strong>
                        {toNumber(
                          cashFlow
                            .net_increase_decrease_in_cash,
                        ) >= 0
                          ? "Net Increase in Cash"
                          : "Net Decrease in Cash"}
                      </strong>
                    </div>

                    <strong>
                      <span>
                        {
                          cashFlow.currency
                        }
                      </span>

                      {formatStatementMoney(
                        cashFlow
                          .net_increase_decrease_in_cash,
                      )}
                    </strong>
                  </div>

                  <section className="cash-flow-reconciliation">
                    <header>
                      <h3>
                        Cash Reconciliation
                      </h3>
                    </header>

                    <div className="cash-flow-reconciliation__lines">
                      <div>
                        <span>
                          Opening cash and
                          cash equivalents
                        </span>

                        <strong>
                          {
                            cashFlow.currency
                          }
                          {" "}
                          {formatStatementMoney(
                            cashFlow
                              .opening_cash_balance,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Net increase or
                          decrease in cash
                        </span>

                        <strong>
                          {
                            cashFlow.currency
                          }
                          {" "}
                          {formatStatementMoney(
                            cashFlow
                              .net_increase_decrease_in_cash,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Calculated closing
                          cash
                        </span>

                        <strong>
                          {
                            cashFlow.currency
                          }
                          {" "}
                          {formatStatementMoney(
                            cashFlow
                              .calculated_closing_cash,
                          )}
                        </strong>
                      </div>

                      <div className="cash-flow-reconciliation__closing">
                        <span>
                          Actual closing cash
                          and cash equivalents
                        </span>

                        <strong>
                          {
                            cashFlow.currency
                          }
                          {" "}
                          {formatStatementMoney(
                            cashFlow
                              .closing_cash_balance,
                          )}
                        </strong>
                      </div>
                    </div>
                  </section>

                  {closingCashSection ? (
                    <CashFlowSection
                      currency={
                        cashFlow.currency
                      }
                      section={
                        closingCashSection
                      }
                    />
                  ) : null}

                  <section
                    className={
                      cashFlow.is_reconciled
                        ? "financial-position-validation financial-position-validation--balanced"
                        : "financial-position-validation financial-position-validation--error"
                    }
                  >
                    <div>
                      <span>
                        Cash reconciliation
                      </span>

                      <strong>
                        {cashFlow.is_reconciled
                          ? "Calculated cash agrees with the ledger"
                          : "Cash balance does not reconcile"}
                      </strong>

                      <p>
                        Difference:{" "}
                        {cashFlow.currency}
                        {" "}
                        {formatStatementMoney(
                          cashFlow
                            .cash_reconciliation_difference,
                        )}
                      </p>
                    </div>

                    <span>
                      {cashFlow.is_reconciled
                        ? "Reconciled"
                        : "Review required"}
                    </span>
                  </section>
                </div>
              ) : null}

              <footer className="complete-report-statement-footer">
                <span>
                  Prepared using the indirect
                  method from posted,
                  non-voided journal entries.
                </span>

                <span>
                  Financial Statement Studio
                </span>
              </footer>
            </article>
          ) : null}
                    {/* NOTES AND DISCLOSURES */}
          <article
  className="complete-report-sheet complete-report-notes-sheet"
  id="complete-report-notes"
  data-complete-report-section="notes"
>
            <header className="complete-report-section-header complete-report-statement-header">
              <span>
                Section 08
              </span>

              <h1>
                Notes to the Financial
                Statements
              </h1>

              <p>
                For the reporting period
                ended{" "}
                {formatDate(
                  report.period_end,
                )}
              </p>
            </header>

            <div className="complete-report-statement-meta">
              <div>
                <span>
                  Company
                </span>

                <strong>
                  {company.name}
                </strong>
              </div>

              <div>
                <span>
                  Currency
                </span>

                <strong>
                  {report.currency}
                </strong>
              </div>
            </div>

            <div className="complete-report-notes-body">
              {activeNotes.length > 0 ? (
                activeNotes.map(
                  (note) => (
                    <section
                      className="printable-report-note complete-report-note"
                      key={note.id}
                    >
                      <header>
                        <span>
                          {note.note_number}
                        </span>

                        <div>
                          <h2>
                            {note.title}
                          </h2>

                          <small>
                            {
                              NOTE_TYPE_LABELS[
                                note.note_type
                              ]
                            }
                          </small>
                        </div>
                      </header>

                      <div className="printable-report-note__content">
                        {note.content ? (
                          note.content
                            .split(/\r?\n/)
                            .map(
                              (
                                paragraph,
                                paragraphIndex,
                              ) => (
                                <p
                                  key={`${note.id}-${paragraphIndex}`}
                                >
                                  {paragraph ||
                                    "\u00A0"}
                                </p>
                              ),
                            )
                        ) : (
                          <p>
                            No disclosure
                            content has been
                            entered for this
                            note.
                          </p>
                        )}
                      </div>

                      {note.statement_name ? (
                        <footer>
                          <span>
                            Related statement
                          </span>

                          <strong>
                            {
                              STATEMENT_NAME_LABELS[
                                note
                                  .statement_name
                              ]
                            }

                            {note.statement_line_key
                              ? ` — ${note.statement_line_key}`
                              : ""}
                          </strong>
                        </footer>
                      ) : null}
                    </section>
                  ),
                )
              ) : (
                <section className="complete-report-incomplete-section">
                  <span>
                    No disclosures
                  </span>

                  <h2>
                    No active notes have
                    been prepared
                  </h2>

                  <p>
                    Accounting policies,
                    explanatory notes and
                    supporting disclosures
                    have not yet been added
                    to this report.
                  </p>

                  <p className="complete-report-notes-empty-followup">
                    Complete the Notes and
                    Disclosures workspace
                    before final printing.
                  </p>
                </section>
              )}
            </div>

            <footer className="complete-report-statement-footer">
              <span>
                These notes form an integral
                part of the financial
                statements.
              </span>

              <span>
                Financial Statement Studio
              </span>
            </footer>
          </article>
                    {/* SUPPORTING SCHEDULES */}
          <article
  className="complete-report-sheet complete-report-schedules-sheet"
  id="complete-report-supporting-schedules"
  data-complete-report-section="supporting-schedules"
>
            <header className="complete-report-section-header complete-report-statement-header">
              <span>
                Section 09
              </span>

              <h1>
                Supporting Schedules
              </h1>

              <p>
                For the reporting period
                ended{" "}
                {formatDate(
                  report.period_end,
                )}
              </p>
            </header>

            <div className="complete-report-statement-meta">
              <div>
                <span>
                  Company
                </span>

                <strong>
                  {company.name}
                </strong>
              </div>

              <div>
                <span>
                  Currency
                </span>

                <strong>
                  {report.currency}
                </strong>
              </div>
            </div>

            {supportingSchedules.length >
            0 ? (
              <div className="complete-report-schedules">
                {supportingSchedules.map(
                  (
                    schedule,
                    scheduleIndex,
                  ) => (
                    <section
                      className="complete-report-schedule"
                      key={
                        schedule.key
                      }
                    >
                      <header className="complete-report-schedule__header">
                        <div>
                          <span>
                            Schedule{" "}
                            {scheduleIndex + 1}
                          </span>

                          <h2>
                            {
                              schedule.title
                            }
                          </h2>
                        </div>

                        <strong>
                          {report.currency}
                        </strong>
                      </header>

                      <div className="complete-report-schedule-table-wrapper">
                        <table className="complete-report-schedule-table">
                          <thead>
                            <tr>
                              <th>
                                Account
                              </th>

                              <th>
                                Description
                              </th>

                              <th>
                                Amount
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {schedule.items.map(
                              (
                                item,
                                itemIndex,
                              ) => (
                                <tr
                                  key={
                                    item
                                      .ledger_account_id ??
                                    `${schedule.key}-${itemIndex}`
                                  }
                                >
                                  <td>
                                    {item.account_code ??
                                      "—"}
                                  </td>

                                  <td>
                                    {
                                      item.account_name
                                    }
                                  </td>

                                  <td className="complete-report-schedule-table__amount">
                                    {formatStatementMoney(
                                      item.amount,
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>

                          <tfoot>
                            <tr>
                              <th
                                colSpan={2}
                              >
                                Total{" "}
                                {
                                  schedule.title
                                }
                              </th>

                              <th className="complete-report-schedule-table__amount">
                                {formatStatementMoney(
                                  schedule.total,
                                )}
                              </th>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </section>
                  ),
                )}
              </div>
            ) : (
              <section className="complete-report-incomplete-section">
                <span>
                  No schedules available
                </span>

                <h2>
                  No supporting account
                  schedules are available
                </h2>

                <p>
                  Supporting schedules will
                  appear automatically when
                  the financial statements
                  contain ledger-account
                  balances that require
                  additional breakdown.
                </p>
              </section>
            )}

            <footer className="complete-report-statement-footer">
              <span>
                Supporting schedules are
                derived from posted,
                non-voided ledger balances
                included in the financial
                statements.
              </span>

              <span>
                Financial Statement Studio
              </span>
            </footer>
          </article>
                    {/* TAX COMPUTATION AND RECONCILIATION */}
          <article
  className="complete-report-sheet complete-report-tax-sheet"
  id="complete-report-tax-computation"
  data-complete-report-section="tax-computation"
>
            <header className="complete-report-section-header complete-report-statement-header">
              <span>
                Section 10
              </span>

              <h1>
                Tax Computation and
                Reconciliation
              </h1>

              <p>
                For the reporting period
                ended{" "}
                {formatDate(
                  report.period_end,
                )}
              </p>
            </header>

            <div className="complete-report-statement-meta">
              <div>
                <span>
                  Company
                </span>

                <strong>
                  {company.name}
                </strong>
              </div>

              <div>
                <span>
                  Currency
                </span>

                <strong>
                  {report.currency}
                </strong>
              </div>
            </div>

            {primaryTaxProfile ? (
              <>
                <section className="complete-report-tax-profile">
                  <header>
                    <span>
                      Taxpayer Profile
                    </span>

                    <h2>
                      {
                        primaryTaxProfile
                          .profile_name
                      }
                    </h2>
                  </header>

                  <div className="complete-report-information-grid">
                    <div>
                      <span>
                        Profile code
                      </span>

                      <strong>
                        {
                          primaryTaxProfile
                            .profile_code
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Jurisdiction
                      </span>

                      <strong>
                        {
                          primaryTaxProfile
                            .jurisdiction_name
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tax identifier
                      </span>

                      <strong>
                        {primaryTaxProfile
                          .tax_identifier ??
                          company.tin ??
                          "Not provided"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Taxpayer category
                      </span>

                      <strong>
                        {primaryTaxProfile
                          .taxpayer_category ??
                          "Not provided"}
                      </strong>
                    </div>
                  </div>
                </section>

                {taxReconciliation &&
                taxReconciliation
                  .calculations.length >
                  0 ? (
                  <section className="complete-report-tax-calculations">
                    <header className="complete-report-tax-subheading">
                      <span>
                        Recorded computations
                      </span>

                      <h2>
                        Tax Calculations
                      </h2>
                    </header>

                    <div className="complete-report-schedule-table-wrapper">
                      <table className="complete-report-schedule-table complete-report-tax-table">
                        <thead>
                          <tr>
                            <th>
                              Date
                            </th>

                            <th>
                              Tax rule
                            </th>

                            <th>
                              Tax base
                            </th>

                            <th>
                              Rate / method
                            </th>

                            <th>
                              Tax amount
                            </th>

                            <th>
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {taxReconciliation
                            .calculations.map(
                              (
                                calculation,
                              ) => (
                                <tr
                                  key={
                                    calculation.id
                                  }
                                >
                                  <td>
                                    {formatDate(
                                      calculation
                                        .calculation_date,
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        calculation
                                          .rule_name_snapshot
                                      }
                                    </strong>

                                    <small className="complete-report-tax-rule-code">
                                      {
                                        calculation
                                          .rule_code_snapshot
                                      }
                                    </small>
                                  </td>

                                  <td className="complete-report-schedule-table__amount">
                                    {formatStatementMoney(
                                      calculation
                                        .tax_base,
                                    )}
                                  </td>

                                  <td>
                                    {formatTaxMethod(
                                      calculation,
                                    )}
                                  </td>

                                  <td className="complete-report-schedule-table__amount">
                                    {formatStatementMoney(
                                      calculation
                                        .tax_amount,
                                    )}
                                  </td>

                                  <td>
                                    <span
                                      className={`complete-report-tax-status complete-report-tax-status--${calculation.status}`}
                                    >
                                      {formatStatus(
                                        calculation.status,
                                      )}
                                    </span>
                                  </td>
                                </tr>
                              ),
                            )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : (
                  <section className="complete-report-incomplete-section">
                    <span>
                      Tax computation
                    </span>

                    <h2>
                      No tax calculations
                      have been recorded
                    </h2>

                    <p>
                      The taxpayer profile
                      exists, but no tax
                      calculation has yet
                      been recorded for this
                      financial report.
                    </p>
                  </section>
                )}

                {taxReconciliation ? (
                  <section className="complete-report-tax-reconciliation">
                    <header className="complete-report-tax-subheading">
                      <span>
                        Ledger comparison
                      </span>

                      <h2>
                        Tax Reconciliation
                      </h2>
                    </header>

                    <div className="complete-report-tax-summary">
                      <div>
                        <span>
                          Profit Before Tax
                        </span>

                        <strong>
                          {report.currency}
                          {" "}
                          {formatStatementMoney(
                            taxReconciliation
                              .profit_before_tax,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Configured Taxation
                        </span>

                        <strong>
                          {report.currency}
                          {" "}
                          {formatStatementMoney(
                            taxReconciliation
                              .configured_taxation,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Ledger Taxation
                        </span>

                        <strong>
                          {report.currency}
                          {" "}
                          {formatStatementMoney(
                            taxReconciliation
                              .ledger_taxation,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Reconciliation
                          Difference
                        </span>

                        <strong>
                          {report.currency}
                          {" "}
                          {formatStatementMoney(
                            taxReconciliation
                              .difference,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Configured Profit
                          After Tax
                        </span>

                        <strong>
                          {report.currency}
                          {" "}
                          {formatStatementMoney(
                            taxReconciliation
                              .configured_profit_after_tax,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Ledger Profit
                          After Tax
                        </span>

                        <strong>
                          {report.currency}
                          {" "}
                          {formatStatementMoney(
                            taxReconciliation
                              .ledger_profit_after_tax,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div
                      className={`complete-report-tax-reconciliation-status complete-report-tax-reconciliation-status--${taxReconciliation.status}`}
                    >
                      <div>
                        <span>
                          Reconciliation
                          status
                        </span>

                        <strong>
                          {formatStatus(
                            taxReconciliation.status,
                          )}
                        </strong>
                      </div>

                      <span>
                        {Number(
                          taxReconciliation
                            .difference,
                        ) === 0
                          ? "No difference"
                          : `${report.currency} ${formatStatementMoney(
                              taxReconciliation
                                .difference,
                            )}`}
                      </span>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="complete-report-incomplete-section">
                <span>
                  Tax not configured
                </span>

                <h2>
                  No taxpayer profile has
                  been configured
                </h2>

                <p>
                  Configure the taxpayer
                  profile, applicable tax
                  rules and report tax
                  calculation before
                  finalising this financial
                  statement package.
                </p>
              </section>
            )}

            <footer className="complete-report-statement-footer">
              <span>
                Tax computations are based
                on the configured effective
                tax rules and are reconciled
                against taxation recorded in
                the ledger.
              </span>

              <span>
                Financial Statement Studio
              </span>
            </footer>
          </article>
        </section>
      ) : null}
    </main>
  );
}