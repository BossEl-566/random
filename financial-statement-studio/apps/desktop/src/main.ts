import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  StandardFonts,
  rgb,
} from "pdf-lib";

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
  value: string,
): boolean {
  try {
    const senderUrl =
      new URL(value);

    const frontendUrl =
      new URL(FRONTEND_URL);

    if (
      senderUrl.origin !==
      frontendUrl.origin
    ) {
      return false;
    }

    return /^\/reports\/[^/]+\/(?:complete-report|statements\/(?:profit-or-loss|financial-position|cash-flows|changes-in-equity|tax-computation))\/?$/.test(
      senderUrl.pathname,
    );
  } catch {
    return false;
  }
}

function isCompleteReportUrl(
  value: string,
): boolean {
  try {
    const senderUrl =
      new URL(value);

    const frontendUrl =
      new URL(FRONTEND_URL);

    if (
      senderUrl.origin !==
      frontendUrl.origin
    ) {
      return false;
    }

    return /^\/reports\/[^/]+\/complete-report\/?$/.test(
      senderUrl.pathname,
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

function dereferencePdfObject(
  pdfDocument: PDFDocument,
  value: unknown,
): unknown {
  if (value instanceof PDFRef) {
    return pdfDocument.context.lookup(
      value,
    );
  }

  return value;
}

function decodePdfDestinationName(
  value: unknown,
): string | null {
  if (
    value instanceof PDFString ||
    value instanceof PDFHexString
  ) {
    return value.decodeText();
  }

  if (value instanceof PDFName) {
    return value
      .toString()
      .replace(/^\/+/, "");
  }

  return null;
}

function findNamedDestinationInTree(
  pdfDocument: PDFDocument,
  node: PDFDict,
  targetName: string,
): PDFArray | null {
  const names =
    node.lookupMaybe(
      PDFName.of("Names"),
      PDFArray,
    );

  if (names) {
    for (
      let index = 0;
      index + 1 < names.size();
      index += 2
    ) {
      const key =
        dereferencePdfObject(
          pdfDocument,
          names.get(index),
        );

      const keyName =
        decodePdfDestinationName(
          key,
        );

      if (
        keyName !== targetName
      ) {
        continue;
      }

      return resolveDestinationArray(
        pdfDocument,
        names.get(index + 1),
      );
    }
  }

  const kids =
    node.lookupMaybe(
      PDFName.of("Kids"),
      PDFArray,
    );

  if (!kids) {
    return null;
  }

  for (
    let index = 0;
    index < kids.size();
    index += 1
  ) {
    const child =
      kids.lookup(
        index,
        PDFDict,
      );

    const result =
      findNamedDestinationInTree(
        pdfDocument,
        child,
        targetName,
      );

    if (result) {
      return result;
    }
  }

  return null;
}

function findNamedDestination(
  pdfDocument: PDFDocument,
  targetName: string,
): PDFArray | null {
  const namesDictionary =
    pdfDocument.catalog.lookupMaybe(
      PDFName.of("Names"),
      PDFDict,
    );

  const destinationsTree =
    namesDictionary?.lookupMaybe(
      PDFName.of("Dests"),
      PDFDict,
    );

  if (destinationsTree) {
    const result =
      findNamedDestinationInTree(
        pdfDocument,
        destinationsTree,
        targetName,
      );

    if (result) {
      return result;
    }
  }

  /*
   * Some PDFs use the older catalog
   * /Dests dictionary instead of a
   * name tree.
   */
  const legacyDestinations =
    pdfDocument.catalog.lookupMaybe(
      PDFName.of("Dests"),
      PDFDict,
    );

  if (!legacyDestinations) {
    return null;
  }

  const legacyValue =
    legacyDestinations.get(
      PDFName.of(
        targetName,
      ),
    );

  if (!legacyValue) {
    return null;
  }

  return resolveDestinationArray(
    pdfDocument,
    legacyValue,
  );
}

function resolveDestinationArray(
  pdfDocument: PDFDocument,
  value: unknown,
): PDFArray | null {
  const resolved =
    dereferencePdfObject(
      pdfDocument,
      value,
    );

  if (
    resolved instanceof
    PDFArray
  ) {
    return resolved;
  }

  if (
    resolved instanceof
    PDFDict
  ) {
    return (
      resolved.lookupMaybe(
        PDFName.of("D"),
        PDFArray,
      ) ?? null
    );
  }

  const destinationName =
    decodePdfDestinationName(
      resolved,
    );

  if (!destinationName) {
    return null;
  }

  return findNamedDestination(
    pdfDocument,
    destinationName,
  );
}

function getAnnotationDestination(
  pdfDocument: PDFDocument,
  annotation: PDFDict,
): PDFArray | null {
  const subtype =
    annotation.lookupMaybe(
      PDFName.of("Subtype"),
      PDFName,
    );

  if (
    subtype?.toString() !==
    "/Link"
  ) {
    return null;
  }

  const directDestination =
    annotation.get(
      PDFName.of("Dest"),
    );

  if (directDestination) {
    const resolved =
      resolveDestinationArray(
        pdfDocument,
        directDestination,
      );

    if (resolved) {
      return resolved;
    }
  }

  const action =
    annotation.lookupMaybe(
      PDFName.of("A"),
      PDFDict,
    );

  if (!action) {
    return null;
  }

  const actionType =
    action.lookupMaybe(
      PDFName.of("S"),
      PDFName,
    );

  if (
    actionType &&
    actionType.toString() !==
      "/GoTo"
  ) {
    return null;
  }

  const actionDestination =
    action.get(
      PDFName.of("D"),
    );

  if (!actionDestination) {
    return null;
  }

  return resolveDestinationArray(
    pdfDocument,
    actionDestination,
  );
}

function getDestinationPageIndex(
  pdfDocument: PDFDocument,
  destination: PDFArray,
): number | null {
  if (
    destination.size() === 0
  ) {
    return null;
  }

  const destinationPage =
    destination.get(0);

  const pages =
    pdfDocument.getPages();

  if (
    destinationPage instanceof
    PDFRef
  ) {
    const destinationRef =
      destinationPage.toString();

    const pageIndex =
      pages.findIndex(
        (page) =>
          page.ref.toString() ===
          destinationRef,
      );

    return pageIndex >= 0
      ? pageIndex
      : null;
  }

  const resolvedPage =
    dereferencePdfObject(
      pdfDocument,
      destinationPage,
    );

  const pageIndex =
    pages.findIndex(
      (page) =>
        page.node ===
        resolvedPage,
    );

  return pageIndex >= 0
    ? pageIndex
    : null;
}

type CompleteReportTocLink = {
  destinationPageIndex: number;

  left: number;
  right: number;
  bottom: number;
  top: number;
};

function getCompleteReportTocLinks(
  pdfDocument: PDFDocument,
): CompleteReportTocLink[] {
  const pages =
    pdfDocument.getPages();

  /*
   * Page index 0 = cover.
   * Page index 1 = table of contents.
   */
  if (pages.length < 2) {
    return [];
  }

  const contentsPage =
    pages[1];

  const annotations =
    contentsPage.node.lookupMaybe(
      PDFName.of("Annots"),
      PDFArray,
    );

  if (!annotations) {
    return [];
  }

  const links:
    CompleteReportTocLink[] =
      [];

  for (
    let index = 0;
    index <
    annotations.size();
    index += 1
  ) {
    const annotation =
      annotations.lookup(
        index,
        PDFDict,
      );

    const destination =
      getAnnotationDestination(
        pdfDocument,
        annotation,
      );

    if (!destination) {
      continue;
    }

    const destinationPageIndex =
      getDestinationPageIndex(
        pdfDocument,
        destination,
      );

    /*
     * TOC entries should point beyond
     * the contents page itself.
     */
    if (
      destinationPageIndex ===
        null ||
      destinationPageIndex <= 1
    ) {
      continue;
    }

    const rectangle =
      annotation.lookupMaybe(
        PDFName.of("Rect"),
        PDFArray,
      );

    if (
      !rectangle ||
      rectangle.size() < 4
    ) {
      continue;
    }

    const x1 =
      rectangle
        .lookup(
          0,
          PDFNumber,
        )
        .asNumber();

    const y1 =
      rectangle
        .lookup(
          1,
          PDFNumber,
        )
        .asNumber();

    const x2 =
      rectangle
        .lookup(
          2,
          PDFNumber,
        )
        .asNumber();

    const y2 =
      rectangle
        .lookup(
          3,
          PDFNumber,
        )
        .asNumber();

    links.push({
      destinationPageIndex,

      left: Math.min(
        x1,
        x2,
      ),

      right: Math.max(
        x1,
        x2,
      ),

      bottom: Math.min(
        y1,
        y2,
      ),

      top: Math.max(
        y1,
        y2,
      ),
    });
  }

  /*
   * PDF coordinates run from the
   * bottom upward, therefore higher
   * TOC rows have larger Y values.
   */
  return links.sort(
    (
      firstLink,
      secondLink,
    ) =>
      secondLink.top -
      firstLink.top,
  );
}

async function addCompleteReportPageNumbers(
  pdfData: Uint8Array,
): Promise<Uint8Array> {
  const pdfDocument =
    await PDFDocument.load(
      pdfData,
    );

  const pages =
    pdfDocument.getPages();

  /*
   * The cover remains unnumbered.
   */
  if (pages.length <= 1) {
    return pdfData;
  }

  const font =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica,
    );

  const footerFontSize = 8;

  const totalNumberedPages =
    pages.length - 1;

  /*
   * ---------------------------------
   * Automatic Table of Contents pages
   * ---------------------------------
   *
   * Chromium created internal PDF
   * destinations from the HTML links.
   *
   * Each destination therefore tells
   * us the REAL physical page where
   * that report section starts.
   */
  const tocLinks =
    getCompleteReportTocLinks(
      pdfDocument,
    );

  const contentsPage =
    pages[1];

  for (
    const link of tocLinks
  ) {
    /*
     * Cover is physical index 0 and
     * excluded from visible numbering.
     *
     * Therefore:
     *
     * physical index 1 = page 1
     * physical index 2 = page 2
     * etc.
     */
    const statementPageNumber =
      link.destinationPageIndex;

    const label =
      String(
        statementPageNumber,
      );

    const fontSize = 9;

    const textWidth =
      font.widthOfTextAtSize(
        label,
        fontSize,
      );

    const rowHeight =
      Math.max(
        12,
        link.top -
          link.bottom,
      );

    /*
     * Cover the HTML placeholder
     * dash in the right-hand TOC
     * column before writing the
     * real number.
     */
    const replacementWidth = 42;

    contentsPage.drawRectangle({
      x:
        link.right -
        replacementWidth,

      y:
        link.bottom + 1,

      width:
        replacementWidth,

      height:
        Math.max(
          1,
          rowHeight - 2,
        ),

      color: rgb(
        1,
        1,
        1,
      ),
    });

    contentsPage.drawText(
      label,
      {
        x:
          link.right -
          textWidth -
          2,

        y:
          link.bottom +
          (rowHeight -
            fontSize) /
            2 +
          1,

        size: fontSize,

        font,

        color: rgb(
          0.2,
          0.25,
          0.33,
        ),
      },
    );
  }

  /*
   * ---------------------------------
   * Footer page numbering
   * ---------------------------------
   */
  for (
    let physicalPageIndex = 1;
    physicalPageIndex <
    pages.length;
    physicalPageIndex += 1
  ) {
    const page =
      pages[
        physicalPageIndex
      ];

    const statementPageNumber =
      physicalPageIndex;

    const label =
      `Page ${statementPageNumber} of ${totalNumberedPages}`;

    const textWidth =
      font.widthOfTextAtSize(
        label,
        footerFontSize,
      );

    const {
      width,
    } = page.getSize();

    page.drawText(
      label,
      {
        x:
          (width -
            textWidth) /
          2,

        y: 18,

        size:
          footerFontSize,

        font,

        color: rgb(
          0.4,
          0.43,
          0.48,
        ),
      },
    );
  }

  if (
    tocLinks.length !== 10
  ) {
    console.warn(
      `[Electron] Expected 10 complete-report TOC links, but found ${tocLinks.length}.`,
    );
  }

  return pdfDocument.save();
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

        const senderUrl =
          event.sender.getURL();

        const generatedPdfData =
          await event.sender.printToPDF({
            landscape: false,
            displayHeaderFooter: false,
            printBackground: true,
            pageSize: "A4",
            preferCSSPageSize: true,
            scale: 1,
          });

        const finalPdfData =
          isCompleteReportUrl(
            senderUrl,
          )
            ? await addCompleteReportPageNumbers(
                generatedPdfData,
              )
            : generatedPdfData;

        await writeFile(
          outputPath,
          finalPdfData,
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