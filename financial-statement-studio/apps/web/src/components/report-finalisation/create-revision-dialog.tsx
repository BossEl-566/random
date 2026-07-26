"use client";

import {
  type FormEvent,
  useState,
} from "react";

import type {
  CreateFinancialReportRevisionPayload,
} from "@/types/report-finalisation";

type CreateRevisionDialogProps = {
  currentTitle: string;
  currentRevisionNumber: number;
  isSubmitting: boolean;

  onCancel(): void;

  onConfirm(
    payload: CreateFinancialReportRevisionPayload,
  ): Promise<void>;
};

export function CreateRevisionDialog({
  currentTitle,
  currentRevisionNumber,
  isSubmitting,
  onCancel,
  onConfirm,
}: CreateRevisionDialogProps) {
  const [title, setTitle] =
    useState(currentTitle);

  const [
    revisionReason,
    setRevisionReason,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    await onConfirm({
      title:
        title.trim() === currentTitle.trim()
          ? null
          : title.trim(),

      revision_reason:
        revisionReason.trim(),
    });
  }

  return (
    <div
      className="notes-dialog-backdrop"
      role="presentation"
    >
      <section
        className="notes-dialog finalisation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-revision-title"
      >
        <header>
          <div>
            <span>
              Controlled correction
            </span>

            <h2 id="create-revision-title">
              Create revision{" "}
              {currentRevisionNumber + 1}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close revision dialog"
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
          <div className="revision-information-box">
            <strong>
              The finalised report remains unchanged.
            </strong>

            <p>
              Journal entries and report notes will be
              copied into a new editable draft revision.
            </p>
          </div>

          <div className="notes-form-grid">
            <label className="notes-form-field notes-form-field--wide">
              <span>
                Revised report title
              </span>

              <input
                required
                maxLength={255}
                value={title}
                disabled={isSubmitting}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Reason for revision
              </span>

              <textarea
                required
                rows={7}
                maxLength={20000}
                value={revisionReason}
                disabled={isSubmitting}
                placeholder="Explain the correction, disclosure change or adjusting entry required."
                onChange={(event) =>
                  setRevisionReason(
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
              className="primary-button"
              type="submit"
              disabled={
                isSubmitting ||
                !title.trim() ||
                !revisionReason.trim()
              }
            >
              {isSubmitting
                ? "Creating revision..."
                : "Create draft revision"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}