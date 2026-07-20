"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  JournalEntry,
} from "@/types/journal-entry";

type VoidJournalEntryDialogProps = {
  entry: JournalEntry;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (
    reason: string,
  ) => Promise<void> | void;
};

export function VoidJournalEntryDialog({
  entry,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: VoidJournalEntryDialogProps) {
  const [reason, setReason] =
    useState("");

  const [
    validationError,
    setValidationError,
  ] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isSubmitting,
    onClose,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const cleanedReason =
      reason.trim();

    if (
      cleanedReason.length < 3
    ) {
      setValidationError(
        "Enter a clear reason containing at least three characters.",
      );

      return;
    }

    setValidationError(null);

    await onConfirm(
      cleanedReason,
    );
  }

  const displayedError =
    validationError ?? error;

  return (
    <div
      className="void-entry-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className="void-entry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="void-entry-title"
      >
        <header className="void-entry-dialog__header">
          <div>
            <p className="eyebrow">
              Audit control
            </p>

            <h2 id="void-entry-title">
              Void journal entry
            </h2>

            <p>
              {entry.entry_number}
              {" — "}
              {entry.description}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close void-entry dialog"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="void-entry-form"
          onSubmit={handleSubmit}
        >
          <div className="void-entry-warning">
            <strong>
              This action affects the Trial Balance
            </strong>

            <p>
              The posted entry will remain in the
              journal for audit history, but its
              amounts will be excluded from the
              Trial Balance.
            </p>
          </div>

          {displayedError ? (
            <div
              className="form-alert form-alert--error"
              role="alert"
            >
              {displayedError}
            </div>
          ) : null}

          <label className="form-field">
            <span>
              Reason for voiding
              <strong>*</strong>
            </span>

            <textarea
              autoFocus
              required
              rows={5}
              minLength={3}
              maxLength={2000}
              disabled={isSubmitting}
              value={reason}
              placeholder="Example: Transaction was posted using the wrong ledger account."
              onChange={(event) => {
                setReason(
                  event.target.value,
                );

                if (validationError) {
                  setValidationError(
                    null,
                  );
                }
              }}
            />

            <small>
              This reason will be permanently
              retained with the journal entry.
            </small>
          </label>

          <footer className="void-entry-form__footer">
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="void-entry-confirm-button"
              type="submit"
              disabled={
                isSubmitting ||
                reason.trim().length < 3
              }
            >
              {isSubmitting
                ? "Voiding entry..."
                : "Confirm void"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}