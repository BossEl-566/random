"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createTaxCalculation,
  listTaxCalculations,
  listTaxRules,
  previewTaxCalculation,
} from "@/lib/tax-configuration-api";
import type {
  TaxCalculation,
  TaxCalculationPreview,
  TaxCalculationPreviewPayload,
  TaxDecimal,
  TaxProfile,
  TaxRule,
} from "@/types/tax-configuration";

type TaxCalculationWorkspaceProps = {
  profile: TaxProfile;

  reportId: string;
  reportCurrency: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  reportStatus: string;
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
    "en-US",
    {
      dateStyle: "medium",
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
    "en-US",
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
      "en-US",
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

function formatPercentage(
  value: TaxDecimal | null,
): string {
  if (value === null) {
    return "Not applicable";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${String(value)}%`;
  }

  return `${amount.toFixed(2)}%`;
}

function formatTaxType(
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

export function TaxCalculationWorkspace({
  profile,
  reportId,
  reportCurrency,
  reportPeriodStart,
  reportPeriodEnd,
  reportStatus,
}: TaxCalculationWorkspaceProps) {
  const [
    rules,
    setRules,
  ] = useState<TaxRule[]>([]);

  const [
    calculations,
    setCalculations,
  ] = useState<TaxCalculation[]>(
    [],
  );

  const [
    selectedRuleCode,
    setSelectedRuleCode,
  ] = useState("");

  const [
    calculationDate,
    setCalculationDate,
  ] = useState(
    reportPeriodEnd,
  );

  const [
    taxBase,
    setTaxBase,
  ] = useState("");

  const [
    preview,
    setPreview,
  ] =
    useState<TaxCalculationPreview | null>(
      null,
    );

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
    isPreviewing,
    setIsPreviewing,
  ] = useState(false);

  const [
    isRecording,
    setIsRecording,
  ] = useState(false);

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  const reportIsLocked = [
    "finalised",
    "printed",
    "archived",
  ].includes(reportStatus);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listTaxRules(
        profile.id,
      ),

      listTaxCalculations(
        reportId,
      ),
    ])
      .then(
        ([
          ruleResponse,
          calculationResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          setRules(
            ruleResponse.items,
          );

          setCalculations(
            calculationResponse.items,
          );

          const availableCodes =
            Array.from(
              new Set(
                ruleResponse.items
                  .filter(
                    (rule) =>
                      rule.status !==
                      "draft",
                  )
                  .map(
                    (rule) =>
                      rule.rule_code,
                  ),
              ),
            );

          setSelectedRuleCode(
            (currentRuleCode) =>
              currentRuleCode &&
              availableCodes.includes(
                currentRuleCode,
              )
                ? currentRuleCode
                : availableCodes[0] ??
                  "",
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
              "Tax calculations could not be loaded.",
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
    profile.id,
    reloadVersion,
    reportId,
  ]);

  const ruleOptions =
    useMemo(() => {
      const seenCodes =
        new Set<string>();

      const options: Array<{
        ruleCode: string;
        ruleName: string;
      }> = [];

      for (const rule of rules) {
        if (
          rule.status === "draft" ||
          seenCodes.has(
            rule.rule_code,
          )
        ) {
          continue;
        }

        seenCodes.add(
          rule.rule_code,
        );

        options.push({
          ruleCode:
            rule.rule_code,

          ruleName:
            rule.rule_name,
        });
      }

      return options;
    }, [rules]);

  const draftCount =
    calculations.filter(
      (calculation) =>
        calculation.status ===
        "draft",
    ).length;

  const confirmedCount =
    calculations.filter(
      (calculation) =>
        calculation.status ===
        "confirmed",
    ).length;

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

  function clearPreview(): void {
    setPreview(null);
  }

  function buildPayload():
    TaxCalculationPreviewPayload | null {
    setStatusMessage(null);

    if (!profile.is_active) {
      setStatusMessage({
        type: "error",
        text:
          "Reactivate the tax profile before creating a tax calculation.",
      });

      return null;
    }

    if (reportIsLocked) {
      setStatusMessage({
        type: "error",
        text:
          "This report is locked. Create a controlled revision before recording another tax calculation.",
      });

      return null;
    }

    if (!selectedRuleCode) {
      setStatusMessage({
        type: "error",
        text:
          "Select an active or historically effective tax rule.",
      });

      return null;
    }

    if (!calculationDate) {
      setStatusMessage({
        type: "error",
        text:
          "Select the tax calculation date.",
      });

      return null;
    }

    if (
      calculationDate <
        reportPeriodStart ||
      calculationDate >
        reportPeriodEnd
    ) {
      setStatusMessage({
        type: "error",
        text:
          "The calculation date must fall within the report period.",
      });

      return null;
    }

    const numericTaxBase =
      Number(taxBase);

    if (
      !Number.isFinite(
        numericTaxBase,
      ) ||
      numericTaxBase < 0
    ) {
      setStatusMessage({
        type: "error",
        text:
          "Enter a valid tax base of zero or greater.",
      });

      return null;
    }

    return {
      tax_profile_id:
        profile.id,

      rule_code:
        selectedRuleCode,

      calculation_date:
        calculationDate,

      tax_base:
        numericTaxBase.toFixed(
          2,
        ),
    };
  }

  async function handlePreview(): Promise<void> {
    const payload =
      buildPayload();

    if (!payload) {
      return;
    }

    setIsPreviewing(true);
    setPreview(null);

    try {
      const response =
        await previewTaxCalculation(
          reportId,
          payload,
        );

      setPreview(
        response,
      );

      setStatusMessage({
        type: "info",
        text:
          "The preview was calculated successfully. Review it before recording the calculation.",
      });
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The tax calculation preview could not be generated.",
        ),
      });
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleRecord(): Promise<void> {
    const payload =
      buildPayload();

    if (
      !payload ||
      !preview
    ) {
      if (!preview) {
        setStatusMessage({
          type: "error",
          text:
            "Generate and review the preview before recording the calculation.",
        });
      }

      return;
    }

    setIsRecording(true);

    try {
      const calculation =
        await createTaxCalculation(
          reportId,
          payload,
        );

      setStatusMessage({
        type: "success",
        text:
          `${calculation.rule_name_snapshot} was recorded as a draft tax calculation.`,
      });

      setPreview(null);
      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The tax calculation could not be recorded.",
        ),
      });
    } finally {
      setIsRecording(false);
    }
  }

  return (
    <section className="version-history-panel">
      <header>
        <div>
          <span>
            Report tax computation
          </span>

          <h2>
            Tax Calculations
          </h2>

          <p>
            Select an effective rule,
            preview the result and record
            an auditable calculation for
            this financial report.
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
          Refresh calculations
        </button>
      </header>

      {reportIsLocked ? (
        <div className="ledger-system-notice">
          <strong>
            Report is locked
          </strong>

          <p>
            Existing calculations remain
            available for review, but new
            calculations cannot be
            recorded in a finalised,
            printed or archived report.
          </p>
        </div>
      ) : null}

      {!profile.is_active ? (
        <div className="ledger-system-notice">
          <strong>
            Tax profile is inactive
          </strong>

          <p>
            Reactivate this profile before
            creating a new calculation.
          </p>
        </div>
      ) : null}

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
            Tax computation unavailable
          </span>

          <h2>
            Tax calculations could not
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
      "ready" ? (
        <>
          <section className="finalisation-readiness-panel">
            <header>
              <div>
                <span>
                  Calculation input
                </span>

                <h2>
                  Preview Tax Amount
                </h2>
              </div>

              <strong>
                {profile.profile_code}
              </strong>
            </header>

            {ruleOptions.length ===
            0 ? (
              <div className="journal-state-card">
                <span>
                  Active rule required
                </span>

                <h2>
                  No effective tax rule
                  is available
                </h2>

                <p>
                  Create and activate a
                  percentage or fixed-amount
                  tax rule before calculating
                  tax.
                </p>
              </div>
            ) : (
              <>
                <div className="ledger-form__grid">
                  <label className="form-field form-field--full">
                    <span>
                      Tax rule
                      <strong>*</strong>
                    </span>

                    <select
                      value={
                        selectedRuleCode
                      }
                      disabled={
                        reportIsLocked ||
                        !profile.is_active
                      }
                      onChange={(event) => {
                        setSelectedRuleCode(
                          event.target.value,
                        );

                        clearPreview();
                      }}
                    >
                      {ruleOptions.map(
                        (option) => (
                          <option
                            value={
                              option.ruleCode
                            }
                            key={
                              option.ruleCode
                            }
                          >
                            {
                              option.ruleCode
                            }
                            {" — "}
                            {
                              option.ruleName
                            }
                          </option>
                        ),
                      )}
                    </select>

                    <small>
                      The backend selects
                      the version of this
                      rule that covers the
                      calculation date.
                    </small>
                  </label>

                  <label className="form-field">
                    <span>
                      Calculation date
                      <strong>*</strong>
                    </span>

                    <input
                      required
                      type="date"
                      min={
                        reportPeriodStart
                      }
                      max={
                        reportPeriodEnd
                      }
                      disabled={
                        reportIsLocked ||
                        !profile.is_active
                      }
                      value={
                        calculationDate
                      }
                      onChange={(event) => {
                        setCalculationDate(
                          event.target.value,
                        );

                        clearPreview();
                      }}
                    />
                  </label>

                  <label className="form-field">
                    <span>
                      Tax base
                      <strong>*</strong>
                    </span>

                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={
                        reportIsLocked ||
                        !profile.is_active
                      }
                      value={
                        taxBase
                      }
                      placeholder="Example: 100000.00"
                      onChange={(event) => {
                        setTaxBase(
                          event.target.value,
                        );

                        clearPreview();
                      }}
                    />

                    <small>
                      Enter the amount to
                      which the selected
                      tax rule should apply.
                    </small>
                  </label>
                </div>

                <footer>
                  <p>
                    The preview does not
                    change the ledger or
                    save a tax calculation.
                  </p>

                  <div className="ledger-form__footer">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={
                        isPreviewing ||
                        isRecording ||
                        reportIsLocked ||
                        !profile.is_active
                      }
                      onClick={() => {
                        void handlePreview();
                      }}
                    >
                      {isPreviewing
                        ? "Calculating..."
                        : "Preview calculation"}
                    </button>

                    <button
                      className="primary-button"
                      type="button"
                      disabled={
                        !preview ||
                        isPreviewing ||
                        isRecording ||
                        reportIsLocked ||
                        !profile.is_active
                      }
                      onClick={() => {
                        void handleRecord();
                      }}
                    >
                      {isRecording
                        ? "Recording..."
                        : "Record calculation"}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>

          {preview ? (
            <section className="finalisation-lock-panel">
              <div>
                <span>
                  Calculation preview
                </span>

                <h2>
                  {preview.rule_name}
                </h2>

                <p>
                  {formatTaxType(
                    preview.tax_type,
                  )}
                  {" · "}
                  {preview.rule_code}
                </p>

                <small>
                  Effective calculation date:{" "}
                  {formatDate(
                    preview.calculation_date,
                  )}
                </small>
              </div>

              <div className="finalisation-lock-panel__metadata">
                <span>
                  Calculated taxation
                </span>

                <strong>
                  {formatMoney(
                    preview.tax_amount,
                    preview.currency,
                  )}
                </strong>

                <small>
                  Tax base:{" "}
                  {formatMoney(
                    preview.tax_base,
                    preview.currency,
                  )}
                </small>

                {preview.calculation_method ===
                "percentage" ? (
                  <small>
                    Rate:{" "}
                    {formatPercentage(
                      preview.rate_applied,
                    )}
                  </small>
                ) : (
                  <small>
                    Fixed amount:{" "}
                    {formatMoney(
                      preview.fixed_amount_applied ??
                        0,
                      preview.currency,
                    )}
                  </small>
                )}

                <small>
                  Preview only — not yet
                  recorded
                </small>
              </div>
            </section>
          ) : null}

          <section className="finalisation-readiness-panel">
            <header>
              <div>
                <span>
                  Calculation summary
                </span>

                <h2>
                  Recorded Tax Calculations
                </h2>
              </div>

              <strong>
                {calculations.length}
                {" "}
                calculation
                {calculations.length ===
                1
                  ? ""
                  : "s"}
              </strong>
            </header>

            <div className="finalisation-metrics">
              <article>
                <span>
                  Total calculations
                </span>

                <strong>
                  {calculations.length}
                </strong>
              </article>

              <article>
                <span>
                  Draft
                </span>

                <strong>
                  {draftCount}
                </strong>
              </article>

              <article>
                <span>
                  Confirmed
                </span>

                <strong>
                  {confirmedCount}
                </strong>
              </article>

              <article>
                <span>
                  Report currency
                </span>

                <strong>
                  {reportCurrency}
                </strong>
              </article>
            </div>
          </section>

          {calculations.length ===
          0 ? (
            <div className="journal-state-card">
              <span>
                No recorded calculation
              </span>

              <h2>
                Preview and record the
                first tax calculation
              </h2>

              <p>
                Recorded calculations retain
                the exact rule details,
                rate, method and amount used
                at the time of calculation.
              </p>
            </div>
          ) : (
            <div className="version-history-list">
              {calculations.map(
                (calculation) => (
                  <section
                    className={
                      calculation.status ===
                      "confirmed"
                        ? "finalisation-lock-panel finalisation-lock-panel--locked"
                        : "finalisation-lock-panel"
                    }
                    key={
                      calculation.id
                    }
                  >
                    <div>
                      <span>
                        {
                          calculation
                            .rule_code_snapshot
                        }
                        {" · "}
                        {
                          calculation.status
                        }
                      </span>

                      <h2>
                        {
                          calculation
                            .rule_name_snapshot
                        }
                      </h2>

                      <p>
                        {formatTaxType(
                          calculation
                            .tax_type_snapshot,
                        )}
                      </p>

                      <small>
                        Calculation date:{" "}
                        {formatDate(
                          calculation
                            .calculation_date,
                        )}
                      </small>

                      <small>
                        Recorded:{" "}
                        {formatDateTime(
                          calculation
                            .calculated_at,
                        )}
                      </small>
                    </div>

                    <div className="finalisation-lock-panel__metadata">
                      <span>
                        Tax amount
                      </span>

                      <strong>
                        {formatMoney(
                          calculation
                            .tax_amount,
                          calculation
                            .currency,
                        )}
                      </strong>

                      <small>
                        Tax base:{" "}
                        {formatMoney(
                          calculation
                            .tax_base,
                          calculation
                            .currency,
                        )}
                      </small>

                      {calculation
                        .calculation_method_snapshot ===
                      "percentage" ? (
                        <small>
                          Rate:{" "}
                          {formatPercentage(
                            calculation
                              .rate_applied,
                          )}
                        </small>
                      ) : (
                        <small>
                          Fixed amount:{" "}
                          {formatMoney(
                            calculation
                              .fixed_amount_applied ??
                              0,
                            calculation
                              .currency,
                          )}
                        </small>
                      )}

                      <small>
                        {calculation.status ===
                        "confirmed"
                          ? "Confirmed through controlled tax posting"
                          : "Awaiting reconciliation and controlled posting"}
                      </small>
                    </div>
                  </section>
                ),
              )}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}