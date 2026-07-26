"use client";

import {
  type FormEvent,
  useState,
} from "react";

import type {
  FinaliseFinancialReportPayload,
} from "@/types/report-finalisation";

type FinaliseReportDialogProps = {
  isSubmitting: boolean;

  onCancel(): void;

  onConfirm(
    payload: FinaliseFinancialReportPayload,
  ): Promise<void>;
};

export function FinaliseReportDialog({
  isSubmitting,
  onCancel,
  onConfirm,
}: FinaliseReportDialogProps) {
  const [
    accountantName,
    setAccountantName,
  ] = useState("");

  const [
    finalisedBy,
    setFinalisedBy,
  ] = useState("");

  const [
    approvalNotes,
    setApprovalNotes,
  ] = useState("");

  const [
    confirmationText,
    setConfirmationText,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    await onConfirm({
      accountant_name:
        accountantName.trim(),

      finalised_by:
        finalisedBy.trim(),

      approval_notes:
        approvalNotes.trim() || null,
    });
  }

  const confirmationIsValid =
    confirmationText.trim().toUpperCase() ===
    "FINALISE";

  return (
    <div
      className="notes-dialog-backdrop"
      role="presentation"
    >
      <section
        className="notes-dialog finalisation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalise-report-title"
      >
        <header>
          <div>
            <span>
              Permanent report lock
            </span>

            <h2 id="finalise-report-title">
              Finalise financial report
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close finalisation dialog"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="finalisation-warning-box">
            <strong>
              Finalisation cannot be undone.
            </strong>

            <p>
              The application will create an immutable
              snapshot and lock report metadata,
              journal entries and disclosures.
              Later corrections require a new revision.
            </p>
          </div>

          <div className="notes-form-grid">
            <label className="notes-form-field">
              <span>
                Accountant or preparer
              </span>

              <input
                required
                maxLength={180}
                value={accountantName}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAccountantName(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-field">
              <span>
                Approved and finalised by
              </span>

              <input
                required
                maxLength={180}
                value={finalisedBy}
                disabled={isSubmitting}
                onChange={(event) =>
                  setFinalisedBy(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Approval notes
              </span>

              <textarea
                rows={5}
                maxLength={20000}
                value={approvalNotes}
                disabled={isSubmitting}
                placeholder="Optional review or approval statement"
                onChange={(event) =>
                  setApprovalNotes(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Type FINALISE to confirm
              </span>

              <input
                required
                autoComplete="off"
                value={confirmationText}
                disabled={isSubmitting}
                onChange={(event) =>
                  setConfirmationText(
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <footer>
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              className="finalisation-danger-button"
              type="submit"
              disabled={
                isSubmitting ||
                !accountantName.trim() ||
                !finalisedBy.trim() ||
                !confirmationIsValid
              }
            >
              {isSubmitting
                ? "Finalising report..."
                : "Finalise and lock report"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}