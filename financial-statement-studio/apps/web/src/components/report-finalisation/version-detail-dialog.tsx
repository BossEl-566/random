"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FinancialReportVersionDetail,
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

        <section className="version-snapshot-panel">
          <header>
            <h3>
              Stored snapshot
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