"use client";

import {
  useState,
} from "react";

type StatementPrintActionsProps = {
  documentTitle: string;
  suggestedFileName: string;
  disabled?: boolean;
};

type ActiveAction =
  | "print"
  | "pdf"
  | null;

type StatusMessage = {
  type:
    | "success"
    | "cancelled"
    | "error"
    | "info";
  message: string;
} | null;

export function StatementPrintActions({
  documentTitle,
  suggestedFileName,
  disabled = false,
}: StatementPrintActionsProps) {
  const [
    activeAction,
    setActiveAction,
  ] = useState<ActiveAction>(
    null,
  );

  const [
    statusMessage,
    setStatusMessage,
  ] = useState<StatusMessage>(
    null,
  );

  const isBusy =
    activeAction !== null;

  const request:
    DesktopPrintRequest = {
      documentTitle,
      suggestedFileName,
    };

  async function handlePrint(): Promise<void> {
    setActiveAction("print");
    setStatusMessage(null);

    try {
      if (
        window.desktopAPI
          ?.isElectron
      ) {
        const result =
          await window.desktopAPI
            .printCurrentPage(
              request,
            );

        setStatusMessage({
          type: result.status,
          message:
            result.message,
        });

        return;
      }

      window.print();

      setStatusMessage({
        type: "info",
        message:
          "The browser print dialog was opened.",
      });
    } catch (error) {
      setStatusMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The statement could not be printed.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSavePdf(): Promise<void> {
    setActiveAction("pdf");
    setStatusMessage(null);

    try {
      if (
        window.desktopAPI
          ?.isElectron
      ) {
        const result =
          await window.desktopAPI
            .saveCurrentPageAsPdf(
              request,
            );

        setStatusMessage({
          type: result.status,
          message:
            result.status ===
              "success" &&
            result.filePath
              ? `${result.message} ${result.filePath}`
              : result.message,
        });

        return;
      }

      window.print();

      setStatusMessage({
        type: "info",
        message:
          "Choose “Save as PDF” in the browser print dialog.",
      });
    } catch (error) {
      setStatusMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The statement could not be saved as a PDF.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="statement-print-actions">
      <div className="statement-print-actions__buttons">
        <button
          className="secondary-button"
          type="button"
          disabled={
            disabled ||
            isBusy
          }
          onClick={() => {
            void handlePrint();
          }}
        >
          {activeAction ===
          "print"
            ? "Opening printer..."
            : "Print statement"}
        </button>

        <button
          className="primary-button"
          type="button"
          disabled={
            disabled ||
            isBusy
          }
          onClick={() => {
            void handleSavePdf();
          }}
        >
          {activeAction === "pdf"
            ? "Creating PDF..."
            : "Save as PDF"}
        </button>
      </div>

      {statusMessage ? (
        <p
          className={`statement-print-actions__status statement-print-actions__status--${statusMessage.type}`}
          role={
            statusMessage.type ===
            "error"
              ? "alert"
              : "status"
          }
          aria-live="polite"
        >
          {statusMessage.message}
        </p>
      ) : null}
    </div>
  );
}