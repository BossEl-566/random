"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FinancialReportVersionDetail,
  FinalisationTaxCalculationSnapshot,
  SnapshotDecimal,
} from "@/types/report-finalisation";

type VerificationState =
  | "checking"
  | "valid"
  | "invalid"
  | "unsupported";

type VersionDetailDialogProps = {
  version: FinancialReportVersionDetail;

  onClose(): void;
};

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
      dateStyle: "medium",
    },
  ).format(date);
}

function formatMoney(
  value: SnapshotDecimal,
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

function formatTaxMethod(
  calculation:
    FinalisationTaxCalculationSnapshot,
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
      ? `${rate.toFixed(2)}% of tax base`
      : `${String(
          calculation.rate_applied,
        )}% of tax base`;
  }

  return `Fixed amount: ${formatMoney(
    calculation.fixed_amount_applied ??
      0,
    calculation.currency,
  )}`;
}

function bytesToHex(
  bytes: Uint8Array,
): string {
  return Array.from(bytes)
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

export function VersionDetailDialog({
  version,
  onClose,
}: VersionDetailDialogProps) {
  const [
    verificationState,
    setVerificationState,
  ] = useState<VerificationState>(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;

    async function verifySnapshot(): Promise<void> {
      const subtle =
        globalThis.crypto?.subtle;

      if (!subtle) {
        if (!cancelled) {
          setVerificationState(
            "unsupported",
          );
        }

        return;
      }

      try {
        const snapshotBytes =
          new TextEncoder().encode(
            version.snapshot_json,
          );

        const digest =
          await subtle.digest(
            "SHA-256",
            snapshotBytes,
          );

        const calculatedChecksum =
          bytesToHex(
            new Uint8Array(digest),
          );

        if (!cancelled) {
          setVerificationState(
            calculatedChecksum ===
              version.snapshot_checksum
              ? "valid"
              : "invalid",
          );
        }
      } catch {
        if (!cancelled) {
          setVerificationState(
            "unsupported",
          );
        }
      }
    }

    void verifySnapshot();

    return () => {
      cancelled = true;
    };
  }, [
    version.snapshot_checksum,
    version.snapshot_json,
  ]);

  const formattedSnapshot =
    useMemo(
      () =>
        JSON.stringify(
          version.snapshot,
          null,
          2,
        ),
      [version.snapshot],
    );

  const taxCalculations =
    version.snapshot
      .tax_calculations ?? [];

  const taxReconciliation =
    version.snapshot
      .tax_reconciliation ?? null;

  const verificationLabel = {
    checking:
      "Verifying snapshot...",
    valid:
      "Checksum verified",
    invalid:
      "Checksum mismatch",
    unsupported:
      "Verification unavailable",
  }[verificationState];

  return (
    <div
      className="notes-dialog-backdrop"
      role="presentation"
    >
      <section
        className="version-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-detail-title"
      >
        <header>
          <div>
            <span>
              Immutable finalised snapshot
            </span>

            <h2 id="version-detail-title">
              Revision{" "}
              {version.revision_number}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close version viewer"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section className="version-detail-summary">
          <div>
            <span>
              Finalised
            </span>

            <strong>
              {formatDateTime(
                version.finalised_at,
              )}
            </strong>
          </div>

          <div>
            <span>
              Accountant
            </span>

            <strong>
              {version.accountant_name}
            </strong>
          </div>

          <div>
            <span>
              Approved by
            </span>

            <strong>
              {version.finalised_by}
            </strong>
          </div>

          <div>
            <span>
              Integrity status
            </span>

            <strong
              className={`snapshot-verification snapshot-verification--${verificationState}`}
            >
              {verificationLabel}
            </strong>
          </div>
        </section>

        <section className="version-checksum-panel">
          <span>
            SHA-256 checksum
          </span>

          <code>
            {version.snapshot_checksum}
          </code>
        </section>

        {version.approval_notes ? (
          <section className="version-approval-notes">
            <span>
              Approval notes
            </span>

            <p>
              {version.approval_notes}
            </p>
          </section>
        ) : null}

        <section className="version-approval-notes">
          <span>
            Snapshot format
          </span>

          <p>
            Version{" "}
            {version.snapshot
              .snapshot_format_version ??
              "Unknown"}
          </p>
        </section>

        {taxReconciliation ? (
          <>
            <section className="version-approval-notes">
              <span>
                Stored tax reconciliation
              </span>

              <p>
                {formatStatus(
                  taxReconciliation.status,
                )}
                {taxReconciliation
                  .requires_attention
                  ? " — review was required when this report was finalised."
                  : " — no outstanding tax review was recorded."}
              </p>
            </section>

            <section className="version-detail-summary">
              <div>
                <span>
                  Configured tax
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .configured_taxation,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Ledger taxation
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .ledger_taxation,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Difference
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .difference,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Profit before tax
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .profit_before_tax,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>
            </section>

            <section className="version-detail-summary">
              <div>
                <span>
                  Draft configured tax
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .draft_configured_taxation,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Confirmed configured tax
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .confirmed_configured_taxation,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Configured profit after tax
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .configured_profit_after_tax,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Ledger profit after tax
                </span>

                <strong>
                  {formatMoney(
                    taxReconciliation
                      .ledger_profit_after_tax,
                    taxReconciliation.currency,
                  )}
                </strong>
              </div>
            </section>
          </>
        ) : (
          <section className="version-approval-notes">
            <span>
              Stored tax reconciliation
            </span>

            <p>
              This snapshot does not contain
              tax reconciliation information.
            </p>
          </section>
        )}

        <section className="version-snapshot-panel">
          <header>
            <h3>
              Stored Tax Calculations
            </h3>

            <span>
              {taxCalculations.length}
              {" "}
              calculation
              {taxCalculations.length ===
              1
                ? ""
                : "s"}
            </span>
          </header>

          {taxCalculations.length ===
          0 ? (
            <div className="version-history-empty">
              <span>
                No stored tax calculation
              </span>

              <p>
                No tax calculation was
                recorded in this finalised
                snapshot.
              </p>
            </div>
          ) : (
            <div className="version-history-list">
              {taxCalculations.map(
                (calculation) => (
                  <section
                    className="finalisation-lock-panel finalisation-lock-panel--locked"
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
                        {formatStatus(
                          calculation.status,
                        )}
                      </span>

                      <h2>
                        {
                          calculation
                            .rule_name_snapshot
                        }
                      </h2>

                      <p>
                        {formatStatus(
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
                        Calculated:{" "}
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

                      <small>
                        {formatTaxMethod(
                          calculation,
                        )}
                      </small>
                    </div>
                  </section>
                ),
              )}
            </div>
          )}
        </section>

        <section className="version-snapshot-panel">
          <header>
            <h3>
              Complete Stored Snapshot
            </h3>

            <span>
              Read-only JSON
            </span>
          </header>

          <pre>
            {formattedSnapshot}
          </pre>
        </section>

        <footer>
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}