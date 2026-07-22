import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} from "electron";
import type {
  IpcMainInvokeEvent,
  SaveDialogOptions,
} from "electron";

import {
  ensureBackendRunning,
  stopBackend,
} from "./backend-manager";
import { waitForUrl } from "./url-waiter";

const FRONTEND_URL =
  process.env.FRONTEND_URL ??
  "http://localhost:3000";

const PRINT_CURRENT_PAGE_CHANNEL =
  "desktop:print-current-page";

const SAVE_CURRENT_PAGE_AS_PDF_CHANNEL =
  "desktop:save-current-page-as-pdf";

type DesktopPrintRequest = {
  documentTitle: string;
  suggestedFileName: string;
};

type DesktopOperationStatus =
  | "success"
  | "cancelled"
  | "error";

type DesktopOperationResult = {
  status: DesktopOperationStatus;
  message: string;
  filePath?: string;
};

let mainWindow: BrowserWindow | null = null;
let shutdownStarted = false;

function isAllowedApplicationUrl(
  targetUrl: string,
): boolean {
  try {
    const allowedOrigin =
      new URL(FRONTEND_URL).origin;

    const targetOrigin =
      new URL(targetUrl).origin;

    return allowedOrigin === targetOrigin;
  } catch {
    return false;
  }
}

function isAllowedStatementUrl(
  targetUrl: string,
): boolean {
  if (
    !isAllowedApplicationUrl(
      targetUrl,
    )
  ) {
    return false;
  }

  try {
    const parsedUrl =
      new URL(targetUrl);

    return /^\/reports\/[^/]+\/statements\/(profit-or-loss|financial-position)\/?$/.test(
      parsedUrl.pathname,
    );
  } catch {
    return false;
  }
}

function requireAllowedStatementSender(
  event: IpcMainInvokeEvent,
): void {
  const senderUrl =
    event.sender.getURL();

  if (
    !isAllowedStatementUrl(
      senderUrl,
    )
  ) {
    throw new Error(
      "Printing is only allowed from a financial statement page.",
    );
  }
}

function normalizePrintRequest(
  value: unknown,
): DesktopPrintRequest {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return {
      documentTitle:
        "Financial Statement",
      suggestedFileName:
        "financial-statement.pdf",
    };
  }

  const request =
    value as Partial<DesktopPrintRequest>;

  const documentTitle =
    typeof request.documentTitle ===
      "string" &&
    request.documentTitle.trim()
      ? request.documentTitle.trim()
      : "Financial Statement";

  const suggestedFileName =
    typeof request.suggestedFileName ===
      "string" &&
    request.suggestedFileName.trim()
      ? request.suggestedFileName.trim()
      : "financial-statement.pdf";

  return {
    documentTitle,
    suggestedFileName,
  };
}

function sanitizePdfFileName(
  value: string,
): string {
  const cleanedName = value
    .replace(
      /[<>:"/\\|?*\u0000-\u001F]/g,
      "-",
    )
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 180);

  const safeName =
    cleanedName ||
    "financial-statement";

  return safeName
    .toLowerCase()
    .endsWith(".pdf")
    ? safeName
    : `${safeName}.pdf`;
}

function ensurePdfExtension(
  filePath: string,
): string {
  return filePath
    .toLowerCase()
    .endsWith(".pdf")
    ? filePath
    : `${filePath}.pdf`;
}

async function showPdfSaveDialog(
  event: IpcMainInvokeEvent,
  request: DesktopPrintRequest,
): Promise<{
  canceled: boolean;
  filePath: string;
}> {
  const parentWindow =
    BrowserWindow.fromWebContents(
      event.sender,
    );

  const options: SaveDialogOptions = {
    title: `Save ${request.documentTitle}`,
    defaultPath: path.join(
      app.getPath("documents"),
      sanitizePdfFileName(
        request.suggestedFileName,
      ),
    ),
    buttonLabel: "Save PDF",
    filters: [
      {
        name: "PDF Document",
        extensions: ["pdf"],
      },
    ],
    properties: [
      "showOverwriteConfirmation",
    ],
  };

  const result = parentWindow
    ? await dialog.showSaveDialog(
        parentWindow,
        options,
      )
    : await dialog.showSaveDialog(
        options,
      );

  return {
    canceled: result.canceled,
    filePath: result.filePath,
  };
}

function registerDesktopIpcHandlers(): void {
  ipcMain.removeHandler(
    PRINT_CURRENT_PAGE_CHANNEL,
  );

  ipcMain.removeHandler(
    SAVE_CURRENT_PAGE_AS_PDF_CHANNEL,
  );

  ipcMain.handle(
    PRINT_CURRENT_PAGE_CHANNEL,
    async (
      event,
      requestValue: unknown,
    ): Promise<DesktopOperationResult> => {
      try {
        requireAllowedStatementSender(
          event,
        );

        normalizePrintRequest(
          requestValue,
        );

        const printResult =
          await new Promise<{
            success: boolean;
            failureReason: string;
          }>((resolve) => {
            event.sender.print(
              {
                silent: false,
                printBackground: true,
                color: true,
                landscape: false,
                margins: {
                  marginType: "default",
                },
                pageSize: "A4",
                copies: 1,
              },
              (
                success,
                failureReason,
              ) => {
                resolve({
                  success,
                  failureReason,
                });
              },
            );
          });

        if (printResult.success) {
          return {
            status: "success",
            message:
              "The statement was sent to the selected printer.",
          };
        }

        const failureReason =
          printResult.failureReason ||
          "The print operation did not complete.";

        if (
          failureReason
            .toLowerCase()
            .includes("cancel")
        ) {
          return {
            status: "cancelled",
            message:
              "Printing was cancelled.",
          };
        }

        return {
          status: "error",
          message: failureReason,
        };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The statement could not be printed.",
        };
      }
    },
  );

  ipcMain.handle(
    SAVE_CURRENT_PAGE_AS_PDF_CHANNEL,
    async (
      event,
      requestValue: unknown,
    ): Promise<DesktopOperationResult> => {
      try {
        requireAllowedStatementSender(
          event,
        );

        const request =
          normalizePrintRequest(
            requestValue,
          );

        const saveResult =
          await showPdfSaveDialog(
            event,
            request,
          );

        if (
          saveResult.canceled ||
          !saveResult.filePath
        ) {
          return {
            status: "cancelled",
            message:
              "PDF saving was cancelled.",
          };
        }

        const outputPath =
          ensurePdfExtension(
            saveResult.filePath,
          );

        const pdfData =
          await event.sender.printToPDF({
            landscape: false,
            displayHeaderFooter: false,
            printBackground: true,
            pageSize: "A4",
            preferCSSPageSize: true,
            scale: 1,
          });

        await writeFile(
          outputPath,
          pdfData,
        );

        return {
          status: "success",
          message:
            "The financial statement was saved successfully.",
          filePath: outputPath,
        };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The statement could not be saved as a PDF.",
        };
      }
    },
  );
}

async function createMainWindow(): Promise<void> {
  console.log(
    `[Electron] Waiting for Next.js at ${FRONTEND_URL}`,
  );

  await waitForUrl(
    FRONTEND_URL,
    60000,
    500,
  );

  console.log(
    "[Electron] Next.js is ready.",
  );

  mainWindow =
    new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: "#f3f5f7",
      title:
        "Financial Statement Studio",
      webPreferences: {
        preload: path.join(
          __dirname,
          "preload.js",
        ),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

  mainWindow.once(
    "ready-to-show",
    () => {
      mainWindow?.show();
    },
  );

  mainWindow.webContents.setWindowOpenHandler(
    () => {
      return {
        action: "deny",
      };
    },
  );

  mainWindow.webContents.on(
    "will-navigate",
    (
      event,
      targetUrl,
    ) => {
      if (
        !isAllowedApplicationUrl(
          targetUrl,
        )
      ) {
        event.preventDefault();
      }
    },
  );

  mainWindow.on(
    "closed",
    () => {
      mainWindow = null;
    },
  );

  await mainWindow.loadURL(
    FRONTEND_URL,
  );
}

async function startApplication(): Promise<void> {
  try {
    await ensureBackendRunning();
    await createMainWindow();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unknown desktop startup error occurred.";

    console.error(
      "[Electron] Startup failed:",
      error,
    );

    dialog.showErrorBox(
      "Financial Statement Studio could not start",
      message,
    );

    app.quit();
  }
}

app.whenReady().then(() => {
  registerDesktopIpcHandlers();

  void startApplication();

  app.on(
    "activate",
    () => {
      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {
        void createMainWindow();
      }
    },
  );
});

app.on(
  "window-all-closed",
  () => {
    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }
  },
);

app.on(
  "before-quit",
  (event) => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    event.preventDefault();

    void stopBackend().finally(
      () => {
        app.exit(0);
      },
    );
  },
);