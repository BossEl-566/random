import {
  contextBridge,
  ipcRenderer,
} from "electron";

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

const desktopApi = {
  isElectron: true,

  platform: process.platform,

  versions: {
    electron:
      process.versions.electron,
    chrome:
      process.versions.chrome,
    node:
      process.versions.node,
  },

  printCurrentPage(
    request: DesktopPrintRequest,
  ): Promise<DesktopOperationResult> {
    return ipcRenderer.invoke(
      PRINT_CURRENT_PAGE_CHANNEL,
      request,
    ) as Promise<DesktopOperationResult>;
  },

  saveCurrentPageAsPdf(
    request: DesktopPrintRequest,
  ): Promise<DesktopOperationResult> {
    return ipcRenderer.invoke(
      SAVE_CURRENT_PAGE_AS_PDF_CHANNEL,
      request,
    ) as Promise<DesktopOperationResult>;
  },
};

contextBridge.exposeInMainWorld(
  "desktopAPI",
  desktopApi,
);