"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { RetireTaxRuleDialog } from "@/components/tax/retire-tax-rule-dialog";
import { TaxRuleEditor } from "@/components/tax/tax-rule-editor";
import {
  activateTaxRule,
  listTaxRules,
} from "@/lib/tax-configuration-api";
import {
  TAX_RULE_STATUS_OPTIONS,
  type TaxProfile,
  type TaxRule,
  type TaxRuleStatus,
} from "@/types/tax-configuration";

type TaxRuleRegisterProps = {
  profile: TaxProfile;
  reportCurrency: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
};

type ResourceState =
  | "loading"
  | "ready"
  | "error";

type EditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      rule: TaxRule;
    }
  | null;

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
  value: string | null,
): string {
  if (!value) {
    return "Open ended";
  }

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
      dateStyle: "medium",
    },
  ).format(date);
}

function formatMoney(
  value: string,
  currency: string,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }

  return new Intl.NumberFormat(
    "en-GH",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

function formatRuleValue(
  rule: TaxRule,
): string {
  if (
    rule.calculation_method ===
    "percentage"
  ) {
    const rate = Number(
      rule.rate_percentage ??
        "0",
    );

    return Number.isFinite(rate)
      ? `${rate.toFixed(2)}%`
      : `${rule.rate_percentage}%`;
  }

  return formatMoney(
    rule.fixed_amount ?? "0",
    rule.currency,
  );
}

function formatStatus(
  status: TaxRuleStatus,
): string {
  return status
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export function TaxRuleRegister({
  profile,
  reportCurrency,
  reportPeriodStart,
  reportPeriodEnd,
}: TaxRuleRegisterProps) {
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
    statusMessage,
    setStatusMessage,
  ] = useState<StatusMessage>(
    null,
  );

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState<
    TaxRuleStatus | ""
  >("");

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  const [
    editorState,
    setEditorState,
  ] = useState<EditorState>(
    null,
  );

  const [
    retiringRule,
    setRetiringRule,
  ] = useState<TaxRule | null>(
    null,
  );

  const [
    actionRuleId,
    setActionRuleId,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    listTaxRules(
      profile.id,
      selectedStatus || undefined,
    )
      .then((response) => {
        if (cancelled) {
          return;
        }

        setRules(
          response.items,
        );

        setResourceState(
          "ready",
        );
      })
      .catch(
        (error: unknown) => {
          if (cancelled) {
            return;
          }

          setLoadError(
            getErrorMessage(
              error,
              "Tax rules could not be loaded.",
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
    selectedStatus,
  ]);

  const counts =
    useMemo(
      () => ({
        draft: rules.filter(
          (rule) =>
            rule.status ===
            "draft",
        ).length,

        active: rules.filter(
          (rule) =>
            rule.status ===
            "active",
        ).length,

        retired: rules.filter(
          (rule) =>
            rule.status ===
            "retired",
        ).length,
      }),
      [rules],
    );

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

  function handleSaved(
    rule: TaxRule,
  ): void {
    setEditorState(null);

    setStatusMessage({
      type: "success",
      text:
        `${rule.rule_name} was saved successfully.`,
    });

    requestReload();
  }

  function handleRetired(
    rule: TaxRule,
  ): void {
    setRetiringRule(null);

    setStatusMessage({
      type: "success",
      text:
        `${rule.rule_name} was retired successfully.`,
    });

    requestReload();
  }

  async function handleActivate(
    rule: TaxRule,
  ): Promise<void> {
    const confirmed =
      window.confirm(
        [
          `Activate ${rule.rule_code} — ${rule.rule_name}?`,
          "",
          "Once active, the rule’s core calculation fields and effective dates cannot be changed.",
        ].join("\n"),
      );

    if (!confirmed) {
      return;
    }

    setActionRuleId(
      rule.id,
    );

    setStatusMessage(null);

    try {
      const activatedRule =
        await activateTaxRule(
          rule.id,
        );

      setStatusMessage({
        type: "success",
        text:
          `${activatedRule.rule_name} is now active.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The tax rule could not be activated.",
        ),
      });
    } finally {
      setActionRuleId(null);
    }
  }

  return (
    <section className="version-history-panel">
      <header>
        <div>
          <span>
            Selected tax profile
          </span>

          <h2>
            {profile.profile_name}
            {" — "}
            Tax Rules
          </h2>

          <p>
            Create draft rules, activate
            approved configurations and
            retire rules without deleting
            their historical audit trail.
          </p>
        </div>

        <div className="ledger-form__footer">
          <button
            className="secondary-button"
            type="button"
            disabled={
              resourceState ===
              "loading"
            }
            onClick={requestReload}
          >
            Refresh rules
          </button>

          <button
            className="primary-button"
            type="button"
            disabled={
              !profile.is_active
            }
            onClick={() =>
              setEditorState({
                mode: "create",
              })
            }
          >
            Add tax rule
          </button>
        </div>
      </header>

      {!profile.is_active ? (
        <div className="ledger-system-notice">
          <strong>
            Profile is inactive
          </strong>

          <p>
            Existing rules remain visible,
            but new rules cannot be created
            until the tax profile is
            reactivated.
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

      <section className="finalisation-readiness-panel">
        <header>
          <div>
            <span>
              Rule filter
            </span>

            <h2>
              Rule Register
            </h2>
          </div>

          <label className="ledger-filter">
            <span>Status</span>

            <select
              value={
                selectedStatus
              }
              onChange={(event) => {
                setResourceState(
                  "loading",
                );

                setSelectedStatus(
                  event.target
                    .value as
                    | TaxRuleStatus
                    | "",
                );
              }}
            >
              <option value="">
                All statuses
              </option>

              {TAX_RULE_STATUS_OPTIONS.map(
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
        </header>

        <div className="finalisation-metrics">
          <article>
            <span>
              Visible rules
            </span>

            <strong>
              {rules.length}
            </strong>
          </article>

          <article>
            <span>
              Draft
            </span>

            <strong>
              {counts.draft}
            </strong>
          </article>

          <article>
            <span>
              Active
            </span>

            <strong>
              {counts.active}
            </strong>
          </article>

          <article>
            <span>
              Retired
            </span>

            <strong>
              {counts.retired}
            </strong>
          </article>
        </div>
      </section>

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
            Rule register unavailable
          </span>

          <h2>
            Tax rules could not be
            loaded
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
      rules.length === 0 ? (
        <div className="journal-state-card">
          <span>
            No matching tax rules
          </span>

          <h2>
            {selectedStatus
              ? `No ${formatStatus(
                  selectedStatus,
                ).toLowerCase()} rules`
              : "Create the first tax rule"}
          </h2>

          <p>
            Draft rules can be reviewed
            before activation. Active rules
            become available for tax
            calculations.
          </p>

          {!selectedStatus &&
          profile.is_active ? (
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                setEditorState({
                  mode: "create",
                })
              }
            >
              Create first rule
            </button>
          ) : null}
        </div>
      ) : null}

      {resourceState ===
        "ready" &&
      rules.length > 0 ? (
        <div className="version-history-list">
          {rules.map(
            (rule) => (
              <section
                className={
                  rule.status ===
                  "retired"
                    ? "finalisation-lock-panel finalisation-lock-panel--locked"
                    : "finalisation-lock-panel"
                }
                key={rule.id}
              >
                <div>
                  <span>
                    {rule.rule_code}
                    {" · "}
                    {formatStatus(
                      rule.status,
                    )}
                  </span>

                  <h2>
                    {rule.rule_name}
                  </h2>

                  <p>
                    {rule.tax_type
                      .replace(
                        /_/g,
                        " ",
                      )}
                  </p>

                  <small>
                    Effective{" "}
                    {formatDate(
                      rule.effective_from,
                    )}
                    {" to "}
                    {formatDate(
                      rule.effective_to,
                    )}
                  </small>

                  {rule.notes ? (
                    <small>
                      {rule.notes}
                    </small>
                  ) : null}
                </div>

                <div className="finalisation-lock-panel__metadata">
                  <span>
                    Calculation
                  </span>

                  <strong>
                    {formatRuleValue(
                      rule,
                    )}
                  </strong>

                  <small>
                    {rule.calculation_method ===
                    "percentage"
                      ? "Percentage of tax base"
                      : "Fixed tax amount"}
                  </small>

                  <small>
                    Currency:{" "}
                    {rule.currency}
                  </small>

                  {rule.source_reference ? (
                    <small>
                      Source:{" "}
                      {
                        rule.source_reference
                      }
                    </small>
                  ) : null}

                  <div className="ledger-form__footer">
                    {rule.status !==
                    "retired" ? (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          actionRuleId !==
                          null
                        }
                        onClick={() =>
                          setEditorState({
                            mode: "edit",
                            rule,
                          })
                        }
                      >
                        {rule.status ===
                        "active"
                          ? "Edit notes"
                          : "Edit rule"}
                      </button>
                    ) : null}

                    {rule.status ===
                    "draft" ? (
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          actionRuleId !==
                          null
                        }
                        onClick={() => {
                          void handleActivate(
                            rule,
                          );
                        }}
                      >
                        {actionRuleId ===
                        rule.id
                          ? "Activating..."
                          : "Activate"}
                      </button>
                    ) : null}

                    {rule.status ===
                    "active" ? (
                      <button
                        className="finalisation-danger-button"
                        type="button"
                        disabled={
                          actionRuleId !==
                          null
                        }
                        onClick={() =>
                          setRetiringRule(
                            rule,
                          )
                        }
                      >
                        Retire
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            ),
          )}
        </div>
      ) : null}

      {editorState ? (
        <TaxRuleEditor
          key={
            editorState.mode ===
            "edit"
              ? editorState.rule.id
              : `new-rule-${profile.id}`
          }
          profile={profile}
          reportCurrency={
            reportCurrency
          }
          reportPeriodStart={
            reportPeriodStart
          }
          rule={
            editorState.mode ===
            "edit"
              ? editorState.rule
              : null
          }
          onClose={() =>
            setEditorState(null)
          }
          onSaved={
            handleSaved
          }
        />
      ) : null}

      {retiringRule ? (
        <RetireTaxRuleDialog
          rule={retiringRule}
          suggestedDate={
            reportPeriodEnd
          }
          onCancel={() =>
            setRetiringRule(null)
          }
          onRetired={
            handleRetired
          }
        />
      ) : null}
    </section>
  );
}