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

function getFirmDisplayName(
  report: FinancialReport,
): string {
  return (
    report.accountant_firm_name?.trim() ||
    "Not provided"
  );
}

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
          ]);

          return {
            reportResponse,
            companyResponse,
            profitOrLossResponse,
            financialPositionResponse,
          };
        },
      )
      .then(
                     ({
          reportResponse,
          companyResponse,
          profitOrLossResponse,
          financialPositionResponse,
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
            Complete report preview
          </strong>

          <span>
            Cover, contents, company
            information and professional
            adviser sections
          </span>
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
          Refresh preview
        </button>
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
          <article className="complete-report-sheet">
            <header className="complete-report-section-header">
              <span>
                Financial Statements
              </span>

              <h1>
                Table of Contents
              </h1>
            </header>

            <div className="complete-report-contents">
              <div>
                <span>01</span>
                <strong>
                  Business Information
                </strong>
              </div>

              <div>
                <span>02</span>
                <strong>
                  Professional Advisers
                </strong>
              </div>

              <div>
                <span>03</span>
                <strong>
                  Accountant Report
                </strong>
              </div>

              <div>
                <span>04</span>
                <strong>
                  Statement of Profit or Loss
                </strong>
              </div>

              <div>
                <span>05</span>
                <strong>
                  Statement of Financial
                  Position
                </strong>
              </div>

              <div>
                <span>06</span>
                <strong>
                  Statement of Changes in
                  Equity
                </strong>
              </div>

              <div>
                <span>07</span>
                <strong>
                  Statement of Cash Flows
                </strong>
              </div>

              <div>
                <span>08</span>
                <strong>
                  Notes and Disclosures
                </strong>
              </div>

              <div>
                <span>09</span>
                <strong>
                  Supporting Schedules
                </strong>
              </div>

              <div>
                <span>10</span>
                <strong>
                  Tax Computation and
                  Reconciliation
                </strong>
              </div>
            </div>

            <p className="complete-report-development-note complete-report-screen-only">
              Statement pages will be
              connected into this package
              during the next assembly
              checkpoints.
            </p>
          </article>

          {/* BUSINESS INFORMATION */}
          <article className="complete-report-sheet">
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
          <article className="complete-report-sheet">
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
          <article className="complete-report-sheet">
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
            <article className="complete-report-sheet complete-report-statement-sheet">
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
            <article className="complete-report-sheet complete-report-statement-sheet">
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
        </section>
      ) : null}
    </main>
  );
}