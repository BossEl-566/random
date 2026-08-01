"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { StatementPrintActions } from "@/components/financial-statements/statement-print-actions";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  getTaxReconciliation,
  listTaxProfiles,
  listTaxRules,
} from "@/lib/tax-configuration-api";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import type {
  TaxCalculation,
  TaxDecimal,
  TaxProfile,
  TaxReconciliation,
  TaxRule,
} from "@/types/tax-configuration";

type TaxComputationReportWorkspaceProps = {
  reportId: string;
};

type ResourceState =
  | "loading"
  | "ready"
  | "error";

type TaxRuleContext = {
  profile: TaxProfile;
  rule: TaxRule;
};

type CalculationContext = {
  calculation: TaxCalculation;
  profile: TaxProfile | null;
  rule: TaxRule | null;
  journalReference: string | null;
};

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

function formatDateTime(
  value: string,
): string {
  const date = new Date(value);

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
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

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
      "en-GH",
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

function formatMethod(
  calculation: TaxCalculation,
): string {
  if (
    calculation
      .calculation_method_snapshot ===
    "percentage"
  ) {
    const rate = Number(
      calculation.rate_applied ??
        0,
    );

    return Number.isFinite(rate)
      ? `${rate.toFixed(2)}%`
      : `${String(
          calculation.rate_applied,
        )}%`;
  }

  return formatMoney(
    calculation.fixed_amount_applied ??
      0,
    calculation.currency,
  );
}

function parseCalculationDetails(
  value: string | null,
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown =
      JSON.parse(value);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<
        string,
        unknown
      >;
    }
  } catch {
    return {};
  }

  return {};
}

function getDetailText(
  details: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = details[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

export function TaxComputationReportWorkspace({
  reportId,
}: TaxComputationReportWorkspaceProps) {
  const [
    report,
    setReport,
  ] = useState<FinancialReport | null>(
    null,
  );

  const [
    company,
    setCompany,
  ] = useState<Company | null>(
    null,
  );

  const [
    reconciliation,
    setReconciliation,
  ] =
    useState<TaxReconciliation | null>(
      null,
    );

  const [
    profiles,
    setProfiles,
  ] = useState<TaxProfile[]>([]);

  const [
    rules,
    setRules,
  ] = useState<TaxRule[]>([]);

  const [
    resourceState,
    setResourceState,
  ] = useState<ResourceState>(
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

    getFinancialReport(reportId)
      .then(
        async (
          reportResponse,
        ) => {
          const [
            companyResponse,
            reconciliationResponse,
            profileResponse,
          ] = await Promise.all([
            getCompany(
              reportResponse.company_id,
            ),

            getTaxReconciliation(
              reportId,
            ),

            listTaxProfiles(
              reportResponse.company_id,
              true,
            ),
          ]);

          const ruleGroups =
            await Promise.all(
              profileResponse.items.map(
                async (profile) => {
                  const ruleResponse =
                    await listTaxRules(
                      profile.id,
                    );

                  return ruleResponse.items;
                },
              ),
            );

          return {
            reportResponse,
            companyResponse,
            reconciliationResponse,
            profileResponse,
            rules: ruleGroups.flat(),
          };
        },
      )
      .then(
        ({
          reportResponse,
          companyResponse,
          reconciliationResponse,
          profileResponse,
          rules: loadedRules,
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

          setReconciliation(
            reconciliationResponse,
          );

          setProfiles(
            profileResponse.items,
          );

          setRules(
            loadedRules,
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
              "The Tax Computation Report could not be loaded.",
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

  const profileById =
    useMemo(
      () =>
        new Map(
          profiles.map(
            (profile) => [
              profile.id,
              profile,
            ],
          ),
        ),
      [profiles],
    );

  const ruleContextById =
    useMemo(() => {
      const contexts =
        new Map<
          string,
          TaxRuleContext
        >();

      for (const rule of rules) {
        const profile =
          profileById.get(
            rule.tax_profile_id,
          );

        if (profile) {
          contexts.set(
            rule.id,
            {
              profile,
              rule,
            },
          );
        }
      }

      return contexts;
    }, [
      profileById,
      rules,
    ]);

  const calculationContexts =
    useMemo<CalculationContext[]>(
      () =>
        reconciliation?.calculations.map(
          (calculation) => {
            const details =
              parseCalculationDetails(
                calculation
                  .calculation_details_json,
              );

            const detailProfileId =
              getDetailText(
                details,
                [
                  "tax_profile_id",
                  "profile_id",
                ],
              );

            const ruleContext =
              ruleContextById.get(
                calculation.tax_rule_id,
              ) ?? null;

            const profile =
              detailProfileId
                ? profileById.get(
                    detailProfileId,
                  ) ??
                  ruleContext?.profile ??
                  null
                : ruleContext?.profile ??
                  null;

            const journalReference =
              getDetailText(
                details,
                [
                  "journal_entry_number",
                  "adjustment_journal_entry_number",
                  "posted_journal_entry_number",
                  "journal_entry_id",
                ],
              );

            return {
              calculation,
              profile,
              rule:
                ruleContext?.rule ??
                null,
              journalReference,
            };
          },
        ) ?? [],
      [
        profileById,
        reconciliation,
        ruleContextById,
      ],
    );

  const usedProfiles =
    useMemo(() => {
      const uniqueProfiles =
        new Map<
          string,
          TaxProfile
        >();

      for (
        const context
        of calculationContexts
      ) {
        if (context.profile) {
          uniqueProfiles.set(
            context.profile.id,
            context.profile,
          );
        }
      }

      if (
        uniqueProfiles.size === 0
      ) {
        const defaultProfile =
          profiles.find(
            (profile) =>
              profile.is_default,
          );

        if (defaultProfile) {
          uniqueProfiles.set(
            defaultProfile.id,
            defaultProfile,
          );
        }
      }

      return Array.from(
        uniqueProfiles.values(),
      );
    }, [
      calculationContexts,
      profiles,
    ]);

  const draftCount =
    reconciliation?.calculations.filter(
      (calculation) =>
        calculation.status ===
        "draft",
    ).length ?? 0;

  const confirmedCount =
    reconciliation?.calculations.filter(
      (calculation) =>
        calculation.status ===
        "confirmed",
    ).length ?? 0;

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

  return (
    <main className="financial-statement-page">
      <header className="app-topbar financial-statement-screen-only">
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
              Tax Computation Report
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports/${reportId}/tax`}
          >
            Tax Configuration
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/statements/profit-or-loss`}
          >
            Profit or loss
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/journal`}
          >
            General Journal
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}`}
          >
            Report overview
          </Link>
        </div>
      </header>

      <section className="financial-statement-toolbar financial-statement-screen-only">
        <div>
          <strong>
            Report tax computation
          </strong>

          <span>
            Recorded tax calculations and
            ledger reconciliation
          </span>
        </div>

        <div>
          <button
            className="text-button"
            type="button"
            disabled={
              resourceState ===
              "loading"
            }
            onClick={requestReload}
          >
            Refresh
          </button>

          <StatementPrintActions
            disabled={
              resourceState !==
                "ready" ||
              !reconciliation
            }
            documentTitle={`${
              company?.name?.trim() ||
              "Company"
            } — Tax Computation Report`}
            suggestedFileName={`${
              company?.name?.trim() ||
              "Company"
            } - Tax Computation Report - ${
              reconciliation?.as_of ??
              report?.period_end ??
              "report"
            }.pdf`}
          />
        </div>
      </section>

      <section
        className="financial-statement-content"
        aria-busy={
          resourceState ===
          "loading"
        }
      >
        {resourceState ===
        "loading" ? (
          <div className="financial-statement-loading financial-statement-screen-only">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState ===
        "error" ? (
          <div className="journal-state-card journal-state-card--error financial-statement-screen-only">
            <span>
              Tax report unavailable
            </span>

            <h2>
              Tax Computation Report
              could not be loaded
            </h2>

            <p>{loadError}</p>

            <button
              className="primary-button"
              type="button"
              onClick={requestReload}
            >
              Try again
            </button>
          </div>
        ) : null}

        {resourceState ===
          "ready" &&
        report &&
        company &&
        reconciliation ? (
          <article className="financial-statement-document tax-computation-document">
            <header className="financial-statement-document__header">
              <div>
                <p>
                  {company.name.trim() ||
                    "Company"}
                </p>

                <h1>
                  Tax Computation Report
                </h1>

                <span>
                  For the period{" "}
                  {formatDate(
                    report.period_start,
                  )}
                  {" to "}
                  {formatDate(
                    report.period_end,
                  )}
                </span>
              </div>

              <div className="financial-statement-document__currency">
                <span>
                  Currency
                </span>

                <strong>
                  {
                    reconciliation.currency
                  }
                </strong>
              </div>
            </header>

            <div className="financial-statement-document__body">
              <section className="tax-computation-profile-section">
                <header>
                  <span>
                    Taxpayer information
                  </span>

                  <h2>
                    Company and Tax Profile
                  </h2>
                </header>

                <div className="tax-computation-profile-grid">
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
                      Registration number
                    </span>

                    <strong>
                      {company.registration_number ??
                        "Not recorded"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Tax identification number
                    </span>

                    <strong>
                      {company.tin ??
                        "Not recorded"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Reporting period
                    </span>

                    <strong>
                      {report.financial_year}
                    </strong>
                  </div>
                </div>

                {usedProfiles.length >
                0 ? (
                  <div className="tax-computation-profile-list">
                    {usedProfiles.map(
                      (profile) => (
                        <article
                          key={profile.id}
                        >
                          <div>
                            <span>
                              {
                                profile.profile_code
                              }
                            </span>

                            <strong>
                              {
                                profile.profile_name
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              Jurisdiction
                            </span>

                            <strong>
                              {
                                profile.jurisdiction_name
                              }
                              {" ("}
                              {
                                profile.jurisdiction_country_code
                              }
                              {")"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Tax identifier
                            </span>

                            <strong>
                              {
                                profile.tax_identifier ??
                                company.tin ??
                                "Not recorded"
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              Taxpayer category
                            </span>

                            <strong>
                              {
                                profile.taxpayer_category ??
                                "Not specified"
                              }
                            </strong>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="tax-computation-empty-note">
                    No tax profile is
                    associated with a recorded
                    calculation.
                  </p>
                )}
              </section>

              <section className="tax-computation-section">
                <header>
                  <div>
                    <span>
                      Detailed computation
                    </span>

                    <h2>
                      Recorded Tax Calculations
                    </h2>
                  </div>

                  <strong>
                    {
                      calculationContexts.length
                    }
                    {" "}
                    calculation
                    {calculationContexts.length ===
                    1
                      ? ""
                      : "s"}
                  </strong>
                </header>

                {calculationContexts.length ===
                0 ? (
                  <div className="tax-computation-empty-note">
                    No tax calculation has
                    been recorded for this
                    report.
                  </div>
                ) : (
                  <div className="tax-computation-table-wrapper">
                    <table className="tax-computation-table">
                      <thead>
                        <tr>
                          <th>
                            Date
                          </th>

                          <th>
                            Rule
                          </th>

                          <th>
                            Profile
                          </th>

                          <th>
                            Tax base
                          </th>

                          <th>
                            Rate or fixed amount
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
                        {calculationContexts.map(
                          ({
                            calculation,
                            profile,
                          }) => (
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
                                      .rule_code_snapshot
                                  }
                                </strong>

                                <span>
                                  {
                                    calculation
                                      .rule_name_snapshot
                                  }
                                </span>

                                <small>
                                  {formatStatus(
                                    calculation
                                      .tax_type_snapshot,
                                  )}
                                </small>
                              </td>

                              <td>
                                {profile ? (
                                  <>
                                    <strong>
                                      {
                                        profile.profile_name
                                      }
                                    </strong>

                                    <span>
                                      {
                                        profile.jurisdiction_name
                                      }
                                    </span>
                                  </>
                                ) : (
                                  "Not resolved"
                                )}
                              </td>

                              <td className="tax-computation-number">
                                {formatMoney(
                                  calculation
                                    .tax_base,
                                  calculation
                                    .currency,
                                )}
                              </td>

                              <td>
                                <strong>
                                  {formatMethod(
                                    calculation,
                                  )}
                                </strong>

                                <span>
                                  {formatStatus(
                                    calculation
                                      .calculation_method_snapshot,
                                  )}
                                </span>
                              </td>

                              <td className="tax-computation-number">
                                <strong>
                                  {formatMoney(
                                    calculation
                                      .tax_amount,
                                    calculation
                                      .currency,
                                  )}
                                </strong>
                              </td>

                              <td>
                                <span
                                  className={`tax-computation-status tax-computation-status--${calculation.status}`}
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
                )}
              </section>

              <section className="tax-computation-section">
                <header>
                  <div>
                    <span>
                      Reconciliation summary
                    </span>

                    <h2>
                      Taxation and Profit
                    </h2>
                  </div>

                  <span
                    className={`tax-computation-status tax-computation-status--${reconciliation.status}`}
                  >
                    {formatStatus(
                      reconciliation.status,
                    )}
                  </span>
                </header>

                <div className="tax-computation-summary">
                  <div>
                    <span>
                      Profit before tax
                    </span>

                    <strong>
                      {formatMoney(
                        reconciliation
                          .profit_before_tax,
                        reconciliation.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Configured taxation
                    </span>

                    <strong>
                      {formatMoney(
                        reconciliation
                          .configured_taxation,
                        reconciliation.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Ledger taxation
                    </span>

                    <strong>
                      {formatMoney(
                        reconciliation
                          .ledger_taxation,
                        reconciliation.currency,
                      )}
                    </strong>
                  </div>

                  <div className="tax-computation-summary__difference">
                    <span>
                      Reconciliation difference
                    </span>

                    <strong>
                      {formatMoney(
                        reconciliation
                          .difference,
                        reconciliation.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Configured profit after tax
                    </span>

                    <strong>
                      {formatMoney(
                        reconciliation
                          .configured_profit_after_tax,
                        reconciliation.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Ledger profit after tax
                    </span>

                    <strong>
                      {formatMoney(
                        reconciliation
                          .ledger_profit_after_tax,
                        reconciliation.currency,
                      )}
                    </strong>
                  </div>
                </div>

                <section
                  className={
                    reconciliation.status ===
                    "reconciled"
                      ? "financial-position-validation financial-position-validation--balanced"
                      : "financial-position-validation financial-position-validation--error"
                  }
                >
                  <div>
                    <span>
                      Tax reconciliation
                    </span>

                    <strong>
                      {reconciliation.status ===
                      "reconciled"
                        ? "Configured taxation agrees with the ledger"
                        : "Taxation requires review"}
                    </strong>

                    <p>
                      Draft calculations:{" "}
                      {draftCount}
                      {" · "}
                      Confirmed calculations:{" "}
                      {confirmedCount}
                    </p>
                  </div>

                  <span>
                    {formatStatus(
                      reconciliation.status,
                    )}
                  </span>
                </section>
              </section>

              <section className="tax-computation-section">
                <header>
                  <div>
                    <span>
                      Controlled posting history
                    </span>

                    <h2>
                      Calculation Audit Trail
                    </h2>
                  </div>
                </header>

                {calculationContexts.length ===
                0 ? (
                  <p className="tax-computation-empty-note">
                    No calculation audit
                    records are available.
                  </p>
                ) : (
                  <div className="tax-computation-table-wrapper">
                    <table className="tax-computation-table tax-computation-audit-table">
                      <thead>
                        <tr>
                          <th>
                            Calculation
                          </th>

                          <th>
                            Recorded
                          </th>

                          <th>
                            Status
                          </th>

                          <th>
                            Adjustment journal
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {calculationContexts.map(
                          ({
                            calculation,
                            journalReference,
                          }) => (
                            <tr
                              key={`audit-${calculation.id}`}
                            >
                              <td>
                                <strong>
                                  {
                                    calculation
                                      .rule_code_snapshot
                                  }
                                </strong>

                                <span>
                                  {
                                    calculation
                                      .rule_name_snapshot
                                  }
                                </span>
                              </td>

                              <td>
                                {formatDateTime(
                                  calculation
                                    .calculated_at,
                                )}
                              </td>

                              <td>
                                {formatStatus(
                                  calculation.status,
                                )}
                              </td>

                              <td>
                                {journalReference ??
                                  (calculation.status ===
                                  "confirmed"
                                    ? "Confirmed through controlled tax posting"
                                    : "Not yet posted")}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <footer className="financial-statement-document__footer">
              <span>
                Prepared from recorded tax
                calculations and posted,
                non-voided ledger entries.
              </span>

              <span>
                Financial Statement Studio
              </span>
            </footer>
          </article>
        ) : null}
      </section>
    </main>
  );
}