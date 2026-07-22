export {};

declare global {
  type DesktopOperationStatus =
    | "success"
    | "cancelled"
    | "error";

  type DesktopPrintRequest = {
    documentTitle: string;
    suggestedFileName: string;
  };

  type DesktopOperationResult = {
    status: DesktopOperationStatus;
    message: string;
    filePath?: string;
  };

  interface DesktopAPI {
    isElectron: boolean;

    platform: string;

    versions: {
      electron: string;
      chrome: string;
      node: string;
    };

    printCurrentPage(
      request: DesktopPrintRequest,
    ): Promise<DesktopOperationResult>;

    saveCurrentPageAsPdf(
      request: DesktopPrintRequest,
    ): Promise<DesktopOperationResult>;
  }

  interface Window {
    desktopAPI?: DesktopAPI;
  }
}