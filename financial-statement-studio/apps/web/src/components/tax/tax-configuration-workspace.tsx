"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { TaxCalculationWorkspace } from "@/components/tax/tax-calculation-workspace";
import { TaxProfileEditor } from "@/components/tax/tax-profile-editor";
import { TaxRuleRegister } from "@/components/tax/tax-rule-register";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  deactivateTaxProfile,
  listTaxProfiles,
  reactivateTaxProfile,
  setDefaultTaxProfile,
} from "@/lib/tax-configuration-api";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import type {
  TaxProfile,
} from "@/types/tax-configuration";

type TaxConfigurationWorkspaceProps = {
  reportId: string;
};

type ResourceState =
  | "loading"
  | "ready"
  | "error";

type StatusMessage = {
  type:
    | "success"
    | "error"
    | "info";
  text: string;
} | null;

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
    },
  ).format(date);
}

export function TaxConfigurationWorkspace({
  reportId,
}: TaxConfigurationWorkspaceProps) {
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
    profiles,
    setProfiles,
  ] = useState<TaxProfile[]>([]);

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
    statusMessage,
    setStatusMessage,
  ] = useState<StatusMessage>(
    null,
  );

  const [
    includeInactive,
    setIncludeInactive,
  ] = useState(true);

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  const [
    showProfileEditor,
    setShowProfileEditor,
  ] = useState(false);

  const [
    actionKey,
    setActionKey,
  ] = useState<string | null>(
    null,
  );

    const [
    selectedProfileId,
    setSelectedProfileId,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    getFinancialReport(reportId)
      .then(
        async (
          reportResponse,
        ) => {
          const [
            companyResponse,
            profileResponse,
          ] = await Promise.all([
            getCompany(
              reportResponse.company_id,
            ),

            listTaxProfiles(
              reportResponse.company_id,
              includeInactive,
            ),
          ]);

          return {
            reportResponse,
            companyResponse,
            profileResponse,
          };
        },
      )
      .then(
        ({
          reportResponse,
          companyResponse,
          profileResponse,
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

          setProfiles(
            profileResponse.items,
          );

          setSelectedProfileId(
            (currentProfileId) => {
                if (
                currentProfileId &&
                profileResponse.items.some(
                  (profile) =>
                    profile.id ===
                    currentProfileId,
                )
              ) {
                return currentProfileId;
              }

              return (
                profileResponse.items.find(
                  (profile) =>
                    profile.is_default &&
                    profile.is_active,
                )?.id ??
                profileResponse.items.find(
                  (profile) =>
                    profile.is_active,
                )?.id ??
                profileResponse.items[0]
                  ?.id ??
                null
              );
            },
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
              "Tax configuration could not be loaded.",
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
    includeInactive,
    reloadVersion,
    reportId,
  ]);

  const orderedProfiles =
    useMemo(
      () =>
        [...profiles].sort(
          (
            firstProfile,
            secondProfile,
          ) => {
            if (
              firstProfile.is_default !==
              secondProfile.is_default
            ) {
              return firstProfile.is_default
                ? -1
                : 1;
            }

            if (
              firstProfile.is_active !==
              secondProfile.is_active
            ) {
              return firstProfile.is_active
                ? -1
                : 1;
            }

            return firstProfile
              .profile_name
              .localeCompare(
                secondProfile
                  .profile_name,
              );
          },
        ),
      [profiles],
    );

  const activeProfileCount =
    profiles.filter(
      (profile) =>
        profile.is_active,
    ).length;

  const defaultProfile =
    profiles.find(
      (profile) =>
        profile.is_default,
    ) ?? null;

      const selectedProfile =
    profiles.find(
      (profile) =>
        profile.id ===
        selectedProfileId,
    ) ?? null;

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

  async function handleProfileSaved(
    profile: TaxProfile,
  ): Promise<void> {
    setShowProfileEditor(false);

    setStatusMessage({
      type: "success",
      text:
        `${profile.profile_name} was created successfully.`,
    });

    requestReload();
  }

  async function handleSetDefault(
    profile: TaxProfile,
  ): Promise<void> {
    const nextActionKey =
      `default:${profile.id}`;

    setActionKey(
      nextActionKey,
    );

    setStatusMessage(null);

    try {
      const updatedProfile =
        await setDefaultTaxProfile(
          profile.id,
        );

      setStatusMessage({
        type: "success",
        text:
          `${updatedProfile.profile_name} is now the default tax profile.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The default tax profile could not be changed.",
        ),
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleDeactivate(
    profile: TaxProfile,
  ): Promise<void> {
    const confirmed =
      window.confirm(
        [
          `Deactivate ${profile.profile_name}?`,
          "",
          "The profile and its historical rules will remain stored, but it cannot be used for new tax calculations while inactive.",
        ].join("\n"),
      );

    if (!confirmed) {
      return;
    }

    const nextActionKey =
      `deactivate:${profile.id}`;

    setActionKey(
      nextActionKey,
    );

    setStatusMessage(null);

    try {
      const updatedProfile =
        await deactivateTaxProfile(
          profile.id,
        );

      setStatusMessage({
        type: "success",
        text:
          `${updatedProfile.profile_name} was deactivated.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The tax profile could not be deactivated.",
        ),
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleReactivate(
    profile: TaxProfile,
  ): Promise<void> {
    const nextActionKey =
      `reactivate:${profile.id}`;

    setActionKey(
      nextActionKey,
    );

    setStatusMessage(null);

    try {
      const updatedProfile =
        await reactivateTaxProfile(
          profile.id,
        );

      setStatusMessage({
        type: "success",
        text:
          `${updatedProfile.profile_name} was reactivated.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The tax profile could not be reactivated.",
        ),
      });
    } finally {
      setActionKey(null);
    }
  }

  return (
    <main className="finalisation-page">
      <header className="app-topbar">
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
              Tax Configuration
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          {company ? (
            <Link
              className="topbar-link"
              href={`/companies/${company.id}/chart-of-accounts`}
            >
              Chart of Accounts
            </Link>
          ) : null}

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/finalisation`}
          >
            Finalisation
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}`}
          >
            Report overview
          </Link>
        </div>
      </header>

      <section className="finalisation-hero">
        <div>
          <p className="eyebrow">
            Company-wide tax settings
          </p>

          <h1>
            Tax Configuration
          </h1>

          <p>
            Manage the taxpayer profiles and
            jurisdictions available when
            calculating taxation for{" "}
            {company?.name ??
              "this company"}.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          disabled={
            !company ||
            !company.is_active ||
            resourceState !== "ready"
          }
          onClick={() =>
            setShowProfileEditor(
              true,
            )
          }
        >
          Add tax profile
        </button>
      </section>

      <section className="finalisation-content">
        {resourceState ===
        "loading" ? (
          <div className="financial-statement-loading">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState ===
        "error" ? (
          <div className="journal-state-card journal-state-card--error">
            <span>
              Tax configuration unavailable
            </span>

            <h2>
              Tax profiles could not
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
          </div>
        ) : null}

        {resourceState ===
          "ready" &&
        report &&
        company ? (
          <>
            {statusMessage ? (
              <div
                className={`notes-status notes-status--${statusMessage.type}`}
                role={
                  statusMessage.type ===
                  "error"
                    ? "alert"
                    : "status"
                }
              >
                {statusMessage.text}
              </div>
            ) : null}

            <section className="finalisation-lock-panel">
              <div>
                <span>
                  Current report
                </span>

                <h2>
                  {report.title}
                </h2>

                <p>
                  Tax profiles are shared
                  across all reports belonging
                  to {company.name}. Changing
                  a company profile does not
                  alter an existing immutable
                  finalised snapshot.
                </p>
              </div>

              <div className="finalisation-lock-panel__metadata">
                <span>
                  Reporting period
                </span>

                <strong>
                  {formatDate(
                    report.period_start,
                  )}
                  {" – "}
                  {formatDate(
                    report.period_end,
                  )}
                </strong>

                <small>
                  Currency:{" "}
                  {report.currency}
                </small>
              </div>
            </section>

            <section className="finalisation-readiness-panel">
              <header>
                <div>
                  <span>
                    Profile summary
                  </span>

                  <h2>
                    Company Tax Profiles
                  </h2>
                </div>

                <button
  className="secondary-button"
  type="button"
  onClick={requestReload}
>
  Refresh profiles
</button>
              </header>

              <div className="finalisation-metrics">
                <article>
                  <span>
                    Total profiles
                  </span>

                  <strong>
                    {profiles.length}
                  </strong>
                </article>

                <article>
                  <span>
                    Active profiles
                  </span>

                  <strong>
                    {activeProfileCount}
                  </strong>
                </article>

                <article>
                  <span>
                    Default profile
                  </span>

                  <strong>
                    {defaultProfile
                      ? defaultProfile
                          .profile_code
                      : "Not selected"}
                  </strong>
                </article>

                <article>
                  <span>
                    Jurisdiction
                  </span>

                  <strong>
                    {defaultProfile
                      ? defaultProfile
                          .jurisdiction_country_code
                      : "—"}
                  </strong>
                </article>
              </div>

              <footer>
                <label className="ledger-inactive-control">
                  <input
                    type="checkbox"
                    checked={
                      includeInactive
                    }
                    onChange={(event) => {
                      setResourceState(
                        "loading",
                      );

                      setIncludeInactive(
                        event.target
                          .checked,
                      );
                    }}
                  />

                  <span>
                    Show inactive profiles
                  </span>
                </label>

                <p>
                  Only active profiles can be
                  selected for new tax rules
                  and tax calculations.
                </p>
              </footer>
            </section>

            {orderedProfiles.length >
            0 ? (
              <section className="version-history-panel">
                <header>
                  <div>
                    <span>
                      Available configurations
                    </span>

                    <h2>
                      Tax Profile Register
                    </h2>

                    <p>
                      Each profile identifies
                      a taxpayer category,
                      jurisdiction and
                      collection of
                      effective-dated tax rules.
                    </p>
                  </div>

                  <strong>
                    {orderedProfiles.length}
                    {" "}
                    profile
                    {orderedProfiles.length ===
                    1
                      ? ""
                      : "s"}
                  </strong>
                </header>

                <div className="version-history-list">
                  {orderedProfiles.map(
                    (profile) => (
                      <section
                        className={
                          profile.is_active
                            ? "finalisation-lock-panel"
                            : "finalisation-lock-panel finalisation-lock-panel--locked"
                        }
                        key={profile.id}
                      >
                        <div>
                          <span>
                            {
                              profile.profile_code
                            }
                          </span>

                          <h2>
                            {
                              profile.profile_name
                            }
                          </h2>

                          <p>
                            {profile.description ??
                              "No profile description has been entered."}
                          </p>

                          <small>
                            Created{" "}
                            {formatDate(
                              profile.created_at,
                            )}
                          </small>
                        </div>

                        <div className="finalisation-lock-panel__metadata">
                          <span>
                            {profile.is_default
                              ? "Default profile"
                              : "Profile status"}
                          </span>

                          <strong>
                            {profile.is_active
                              ? "Active"
                              : "Inactive"}
                          </strong>

                          <small>
                            {
                              profile.jurisdiction_name
                            }
                            {" · "}
                            {
                              profile
                                .jurisdiction_country_code
                            }
                          </small>

                          {profile.taxpayer_category ? (
                            <small>
                              {
                                profile
                                  .taxpayer_category
                              }
                            </small>
                          ) : null}

                          {profile.tax_identifier ? (
                            <small>
                              Tax ID:{" "}
                              {
                                profile
                                  .tax_identifier
                              }
                            </small>
                          ) : null}

                                                    <div className="ledger-form__footer">
                            <button
                              className={
                                selectedProfileId ===
                                profile.id
                                  ? "primary-button"
                                  : "secondary-button"
                              }
                              type="button"
                              disabled={
                                actionKey !==
                                null
                              }
                              onClick={() =>
                                setSelectedProfileId(
                                  profile.id,
                                )
                              }
                            >
                              {selectedProfileId ===
                              profile.id
                                ? "Rules selected"
                                : "Manage rules"}
                            </button>

                            {profile.is_active &&
                            !profile.is_default ? (
                              <button
                                className="secondary-button"
                                type="button"
                                disabled={
                                  actionKey !==
                                  null
                                }
                                onClick={() => {
                                  void handleSetDefault(
                                    profile,
                                  );
                                }}
                              >
                                {actionKey ===
                                `default:${profile.id}`
                                  ? "Updating..."
                                  : "Make default"}
                              </button>
                            ) : null}

                            {profile.is_active ? (
                              <button
                                className="text-button"
                                type="button"
                                disabled={
                                  actionKey !==
                                  null
                                }
                                onClick={() => {
                                  void handleDeactivate(
                                    profile,
                                  );
                                }}
                              >
                                {actionKey ===
                                `deactivate:${profile.id}`
                                  ? "Deactivating..."
                                  : "Deactivate"}
                              </button>
                            ) : (
                              <button
                                className="primary-button"
                                type="button"
                                disabled={
                                  actionKey !==
                                  null
                                }
                                onClick={() => {
                                  void handleReactivate(
                                    profile,
                                  );
                                }}
                              >
                                {actionKey ===
                                `reactivate:${profile.id}`
                                  ? "Reactivating..."
                                  : "Reactivate"}
                              </button>
                            )}
                          </div>
                        </div>
                      </section>
                    ),
                  )}
                </div>
              </section>
            ) : (
              <div className="journal-state-card">
                <span>
                  No tax profiles
                </span>

                <h2>
                  Create the company’s
                  first tax profile
                </h2>

                <p>
                  Begin by recording the tax
                  jurisdiction, taxpayer
                  category and profile name.
                  Tax rules will be added in
                  the next checkpoint.
                </p>

                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    !company.is_active
                  }
                  onClick={() =>
                    setShowProfileEditor(
                      true,
                    )
                  }
                >
                  Create first profile
                </button>
              </div>
            )}
            {selectedProfile ? (
  <>
    <TaxRuleRegister
      key={`rules-${selectedProfile.id}`}
      profile={selectedProfile}
      reportCurrency={
        report.currency
      }
      reportPeriodStart={
        report.period_start
      }
      reportPeriodEnd={
        report.period_end
      }
    />

    <TaxCalculationWorkspace
      key={`calculations-${selectedProfile.id}`}
      profile={selectedProfile}
      reportId={report.id}
      reportCurrency={
        report.currency
      }
      reportPeriodStart={
        report.period_start
      }
      reportPeriodEnd={
        report.period_end
      }
      reportStatus={
        report.status
      }
    />
  </>
) : null}
          </>
        ) : null}
      </section>

      {showProfileEditor &&
      company ? (
        <TaxProfileEditor
          company={company}
          onClose={() =>
            setShowProfileEditor(
              false,
            )
          }
          onSaved={
            handleProfileSaved
          }
        />
      ) : null}
    </main>
  );
}