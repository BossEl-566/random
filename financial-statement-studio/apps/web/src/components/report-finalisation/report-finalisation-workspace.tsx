"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import { CreateRevisionDialog } from "@/components/report-finalisation/create-revision-dialog";
import { FinaliseReportDialog } from "@/components/report-finalisation/finalise-report-dialog";
import { VersionDetailDialog } from "@/components/report-finalisation/version-detail-dialog";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  createFinancialReportRevision,
  finaliseFinancialReport,
  getFinancialReportVersion,
  getReportFinalisationReadiness,
  listFinancialReportVersions,
} from "@/lib/report-finalisation-api";
import type {
  Company,
} from "@/types/company";
import type {
  CreateFinancialReportRevisionPayload,
  FinalisationFinancialReport,
  FinaliseFinancialReportPayload,
  FinancialReportVersionDetail,
  FinancialReportVersionSummary,
  ReportFinalisationReadiness,
} from "@/types/report-finalisation";

type ReportFinalisationWorkspaceProps = {
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

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Not finalised";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(value),
  );
}

function formatStatus(
  value: string,
): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatMoney(
  value: string | number,
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

function isTaxCheck(
  code: string,
): boolean {
  return [
    "tax_not_configured",
    "draft_tax_calculations",
    "tax_under_posted",
    "tax_over_posted",
  ].includes(code);
}

export function ReportFinalisationWorkspace({
  reportId,
}: ReportFinalisationWorkspaceProps) {
  const router = useRouter();

  const [
    report,
    setReport,
  ] =
    useState<FinalisationFinancialReport | null>(
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
    readiness,
    setReadiness,
  ] =
    useState<ReportFinalisationReadiness | null>(
      null,
    );

  const [
    versions,
    setVersions,
  ] =
    useState<
      FinancialReportVersionSummary[]
    >([]);

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
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  const [
    showFinaliseDialog,
    setShowFinaliseDialog,
  ] = useState(false);

  const [
    showRevisionDialog,
    setShowRevisionDialog,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    selectedVersion,
    setSelectedVersion,
  ] =
    useState<FinancialReportVersionDetail | null>(
      null,
    );

  const [
    loadingVersionId,
    setLoadingVersionId,
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
          const typedReport =
            reportResponse as FinalisationFinancialReport;

          const [
            companyResponse,
            readinessResponse,
            versionResponse,
          ] = await Promise.all([
            getCompany(
              typedReport.company_id,
            ),

            getReportFinalisationReadiness(
              reportId,
            ),

            listFinancialReportVersions(
              reportId,
            ),
          ]);

          return {
            typedReport,
            companyResponse,
            readinessResponse,
            versionResponse,
          };
        },
      )
      .then(
        ({
          typedReport,
          companyResponse,
          readinessResponse,
          versionResponse,
        }) => {
          if (cancelled) {
            return;
          }

          setReport(
            typedReport,
          );

          setCompany(
            companyResponse,
          );

          setReadiness(
            readinessResponse,
          );

          setVersions(
            versionResponse.items,
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
              "The finalisation workspace could not be loaded.",
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

  const orderedVersions =
    useMemo(
      () =>
        [...versions].sort(
          (
            firstVersion,
            secondVersion,
          ) =>
            secondVersion
              .revision_number -
            firstVersion
              .revision_number,
        ),
      [versions],
    );

  const reportIsLocked =
    report
      ? [
          "finalised",
          "printed",
          "archived",
        ].includes(
          report.status,
        )
      : false;

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

  async function handleFinalise(
    payload: FinaliseFinancialReportPayload,
  ): Promise<void> {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response =
        await finaliseFinancialReport(
          reportId,
          payload,
        );

      setShowFinaliseDialog(false);

      setStatusMessage({
        type: "success",
        text:
          `Revision ${response.revision_number} was finalised and locked successfully.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The financial report could not be finalised.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateRevision(
    payload:
      CreateFinancialReportRevisionPayload,
  ): Promise<void> {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const revisedReport =
        await createFinancialReportRevision(
          reportId,
          payload,
        );

      setShowRevisionDialog(false);

      router.push(
        `/reports/${revisedReport.id}`,
      );
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The draft revision could not be created.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openVersion(
    versionId: string,
  ): Promise<void> {
    setLoadingVersionId(
      versionId,
    );

    setStatusMessage(null);

    try {
      const version =
        await getFinancialReportVersion(
          versionId,
        );

      setSelectedVersion(
        version,
      );
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The stored report version could not be opened.",
        ),
      });
    } finally {
      setLoadingVersionId(null);
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
              Report Finalisation
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
            href={`/reports/${reportId}/trial-balance`}
          >
            Trial Balance
          </Link>

          <Link
            className="topbar-link"
            href={`/reports/${reportId}/notes`}
          >
            Notes
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
            {company?.name ??
              "Approval and version control"}
          </p>

          <h1>
            Finalisation and Revisions
          </h1>

          <p>
            Verify report readiness, create an
            immutable approved version and manage
            controlled corrections without changing
            previously finalised statements.
          </p>
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
          Refresh checks
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
              Finalisation unavailable
            </span>

            <h2>
              Finalisation information could not
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
        readiness ? (
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

            <section
              className={
                reportIsLocked
                  ? "finalisation-lock-panel finalisation-lock-panel--locked"
                  : "finalisation-lock-panel"
              }
            >
              <div>
                <span>
                  Current report status
                </span>

                <h2>
                  {formatStatus(
                    report.status,
                  )}
                </h2>

                <p>
                  Revision{" "}
                  {report.revision_number}
                  {reportIsLocked
                    ? " is immutable. Changes require a controlled revision."
                    : " remains editable until formal finalisation."}
                </p>
              </div>

              <div className="finalisation-lock-panel__metadata">
                <span>
                  Finalised
                </span>

                <strong>
                  {formatDateTime(
                    report.finalised_at,
                  )}
                </strong>

                {report.finalised_by ? (
                  <small>
                    Approved by{" "}
                    {report.finalised_by}
                  </small>
                ) : null}
              </div>
            </section>

            <section className="finalisation-readiness-panel">
              <header>
                <div>
                  <span>
                    Readiness assessment
                  </span>

                  <h2>
                    {readiness.can_finalise
                      ? "Report is ready for finalisation"
                      : reportIsLocked
                        ? "Report is already locked"
                        : "Action is required before finalisation"}
                  </h2>
                </div>

                <strong
                  className={
                    readiness.can_finalise
                      ? "readiness-badge readiness-badge--ready"
                      : "readiness-badge readiness-badge--blocked"
                  }
                >
                  {readiness.can_finalise
                    ? "Ready"
                    : "Not ready"}
                </strong>
              </header>

              <div className="finalisation-metrics">
                <article>
                  <span>
                    Posted entries
                  </span>

                  <strong>
                    {
                      readiness.posted_entry_count
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Draft entries
                  </span>

                  <strong>
                    {
                      readiness.draft_entry_count
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Active notes
                  </span>

                  <strong>
                    {
                      readiness.active_note_count
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Trial Balance
                  </span>

                  <strong>
                    {readiness.trial_balance_is_balanced
                      ? "Balanced"
                      : "Unbalanced"}
                  </strong>
                </article>
              </div>
                            <div className="finalisation-metrics">
                <article>
                  <span>
                    Tax calculations
                  </span>

                  <strong>
                    {
                      readiness.tax_calculation_count
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Draft tax calculations
                  </span>

                  <strong>
                    {
                      readiness
                        .draft_tax_calculation_count
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    Tax reconciliation
                  </span>

                  <strong>
                    {formatStatus(
                      readiness
                        .tax_reconciliation_status,
                    )}
                  </strong>
                </article>

                <article>
                  <span>
                    Tax difference
                  </span>

                  <strong>
                    {formatMoney(
                      readiness
                        .tax_reconciliation_difference,
                      report.currency,
                    )}
                  </strong>
                </article>
              </div>

              {readiness.blockers.length >
              0 ? (
                <section className="finalisation-check-list finalisation-check-list--blockers">
                  <header>
                    <h3>
                      Blocking issues
                    </h3>
                  </header>

                  {readiness.blockers.map(
                    (blocker) => (
                      <article
                        key={blocker.code}
                      >
                        <span>!</span>

                        <div>
                          <strong>
                            {blocker.title}
                          </strong>

                          <p>
                            {blocker.detail}
                          </p>
                        </div>
                      </article>
                    ),
                  )}
                </section>
              ) : null}

              {readiness.warnings.length >
              0 ? (
                <section className="finalisation-check-list finalisation-check-list--warnings">
                  <header>
                    <h3>
                      Review warnings
                    </h3>
                  </header>

                  {readiness.warnings.map(
                    (warning) => (
                      <article
                        key={warning.code}
                      >
                        <span>i</span>

                        <div>
                          <strong>
                            {warning.title}
                          </strong>

                                                    <p>
                            {warning.detail}
                          </p>

                          {isTaxCheck(
                            warning.code,
                          ) ? (
                            <Link
                              className="text-button"
                              href={`/reports/${reportId}/tax`}
                            >
                              Review tax configuration
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    ),
                  )}
                </section>
              ) : null}

              {!reportIsLocked ? (
                <footer>
                  <p>
                    Warnings do not prevent
                    finalisation. Blocking issues
                    must be resolved first.
                  </p>

                  <button
                    className="finalisation-danger-button"
                    type="button"
                    disabled={
                      !readiness.can_finalise
                    }
                    onClick={() =>
                      setShowFinaliseDialog(
                        true,
                      )
                    }
                  >
                    Finalise report
                  </button>
                </footer>
              ) : null}
            </section>
                        <section className="finalisation-lock-panel">
              <div>
                <span>
                  Tax finalisation control
                </span>

                <h2>
                  {formatStatus(
                    readiness
                      .tax_reconciliation_status,
                  )}
                </h2>

                <p>
                  The finalisation snapshot
                  will preserve the report’s
                  tax calculations, rule
                  snapshots and reconciliation
                  position.
                </p>
              </div>

              <div className="finalisation-lock-panel__metadata">
                <span>
                  Reconciliation difference
                </span>

                <strong>
                  {formatMoney(
                    readiness
                      .tax_reconciliation_difference,
                    report.currency,
                  )}
                </strong>

                <small>
                  {
                    readiness.tax_calculation_count
                  }
                  {" "}
                  recorded calculation
                  {readiness.tax_calculation_count ===
                  1
                    ? ""
                    : "s"}
                </small>

                <Link
                  className="secondary-button"
                  href={`/reports/${reportId}/tax`}
                >
                  Review taxation
                </Link>
              </div>
            </section>

            <section className="version-history-panel">
              <header>
                <div>
                  <span>
                    Immutable audit history
                  </span>

                  <h2>
                    Finalised Versions
                  </h2>

                  <p>
                    Each finalised revision is retained
                    with its approval details, complete
                    data snapshot and checksum.
                  </p>
                </div>

                <strong>
                  {orderedVersions.length}
                  {" "}
                  version
                  {orderedVersions.length === 1
                    ? ""
                    : "s"}
                </strong>
              </header>

              <div className="version-history-list">
                {orderedVersions.length >
                0 ? (
                  orderedVersions.map(
                    (version) => (
                      <article
                        key={version.id}
                      >
                        <div className="version-history-number">
                          <span>
                            Revision
                          </span>

                          <strong>
                            {
                              version.revision_number
                            }
                          </strong>
                        </div>

                        <div className="version-history-details">
                          <strong>
                            Finalised{" "}
                            {formatDateTime(
                              version.finalised_at,
                            )}
                          </strong>

                          <span>
                            Prepared by{" "}
                            {
                              version.accountant_name
                            }
                            {" · "}
                            Approved by{" "}
                            {
                              version.finalised_by
                            }
                          </span>

                          <code>
                            {
                              version.snapshot_checksum
                            }
                          </code>
                        </div>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            loadingVersionId ===
                            version.id
                          }
                          onClick={() => {
                            void openVersion(
                              version.id,
                            );
                          }}
                        >
                          {loadingVersionId ===
                          version.id
                            ? "Opening..."
                            : "View snapshot"}
                        </button>
                      </article>
                    ),
                  )
                ) : (
                  <div className="version-history-empty">
                    <span>
                      No immutable version yet
                    </span>

                    <p>
                      A version will be created when
                      the report is formally finalised.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {report.status ===
            "finalised" ? (
              <section className="create-revision-panel">
                <div>
                  <span>
                    Controlled corrections
                  </span>

                  <h2>
                    Create a New Draft Revision
                  </h2>

                  <p>
                    The finalised report remains
                    unchanged. Its journals and notes
                    will be copied into a new editable
                    revision.
                  </p>
                </div>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    setShowRevisionDialog(
                      true,
                    )
                  }
                >
                  Create revision{" "}
                  {report.revision_number +
                    1}
                </button>
              </section>
            ) : null}
          </>
        ) : null}
      </section>

      {showFinaliseDialog ? (
        <FinaliseReportDialog
          isSubmitting={isSubmitting}
          onCancel={() =>
            setShowFinaliseDialog(
              false,
            )
          }
          onConfirm={handleFinalise}
        />
      ) : null}

      {showRevisionDialog &&
      report ? (
        <CreateRevisionDialog
          currentTitle={report.title}
          currentRevisionNumber={
            report.revision_number
          }
          isSubmitting={isSubmitting}
          onCancel={() =>
            setShowRevisionDialog(
              false,
            )
          }
          onConfirm={
            handleCreateRevision
          }
        />
      ) : null}

      {selectedVersion ? (
        <VersionDetailDialog
          key={selectedVersion.id}
          version={selectedVersion}
          onClose={() =>
            setSelectedVersion(null)
          }
        />
      ) : null}
    </main>
  );
}