import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
} from "electron";

import {
  ensureBackendRunning,
  stopBackend,
} from "./backend-manager";
import { waitForUrl } from "./url-waiter";

const FRONTEND_URL =
  process.env.FRONTEND_URL ??
  "http://localhost:3000";

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

async function createMainWindow(): Promise<void> {
  console.log(
    `[Electron] Waiting for Next.js at ${FRONTEND_URL}`,
  );

  await waitForUrl(
    FRONTEND_URL,
    60000,
    500,
  );

  console.log("[Electron] Next.js is ready.");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f3f5f7",
    title: "Financial Statement Studio",
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

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(
    () => {
      return {
        action: "deny",
      };
    },
  );

  mainWindow.webContents.on(
    "will-navigate",
    (event, targetUrl) => {
      if (
        !isAllowedApplicationUrl(targetUrl)
      ) {
        event.preventDefault();
      }
    },
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(FRONTEND_URL);
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
  void startApplication();

  app.on("activate", () => {
    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  event.preventDefault();

  void stopBackend().finally(() => {
    app.exit(0);
  });
});