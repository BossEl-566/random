import type {
  ChildProcess,
} from "node:child_process";
import {
  spawn,
} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  app,
} from "electron";

import {
  checkUrl,
  waitForUrl,
} from "./url-waiter";

const FRONTEND_HOST =
  "127.0.0.1";

const FRONTEND_PORT =
  "3000";

const FRONTEND_URL =
  `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;

let frontendProcess:
  ChildProcess | null = null;

let frontendStartedByElectron =
  false;

function getFrontendDirectory(): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "web-runtime",
      "apps",
      "web",
    );
  }

  return path.resolve(
    __dirname,
    "..",
    "..",
    "web",
    ".next",
    "standalone",
    "apps",
    "web",
  );
}

function getFrontendServerPath(
  frontendDirectory: string,
): string {
  return path.join(
    frontendDirectory,
    "server.js",
  );
}

function logFrontendOutput(
  label: "stdout" | "stderr",
  data: Buffer,
): void {
  const output =
    data.toString().trim();

  if (!output) {
    return;
  }

  for (
    const line of output.split(
      /\r?\n/,
    )
  ) {
    console.log(
      `[Next.js ${label}] ${line}`,
    );
  }
}

export async function ensureFrontendRunning(): Promise<void> {
  const frontendAlreadyRunning =
    await checkUrl(
      FRONTEND_URL,
    );

  if (frontendAlreadyRunning) {
    console.log(
      `[Electron] Next.js is already running at ${FRONTEND_URL}`,
    );

    frontendStartedByElectron =
      false;

    return;
  }

  const frontendDirectory =
    getFrontendDirectory();

  const serverPath =
    getFrontendServerPath(
      frontendDirectory,
    );

  if (
    !fs.existsSync(
      frontendDirectory,
    )
  ) {
    throw new Error(
      [
        "The packaged Next.js frontend was not found.",
        `Expected directory: ${frontendDirectory}`,
        "Run the web production build before starting Electron.",
      ].join(" "),
    );
  }

  if (
    !fs.existsSync(
      serverPath,
    )
  ) {
    throw new Error(
      [
        "The standalone Next.js server was not found.",
        `Expected server: ${serverPath}`,
        "Run npm run build in apps/web first.",
      ].join(" "),
    );
  }

  console.log(
    "[Electron] Starting the Next.js frontend...",
  );

  console.log(
    `[Electron] Frontend directory: ${frontendDirectory}`,
  );

  /*
   * Electron includes a Node.js runtime.
   * ELECTRON_RUN_AS_NODE lets that
   * runtime execute Next.js server.js
   * without requiring Node.js to be
   * separately installed on the user's PC.
   */
  frontendProcess =
    spawn(
      process.execPath,
      [
        serverPath,
      ],
      {
        cwd:
          frontendDirectory,

        windowsHide: true,

        env: {
          ...process.env,

          ELECTRON_RUN_AS_NODE:
            "1",

          NODE_ENV:
            "production",

          HOSTNAME:
            FRONTEND_HOST,

          PORT:
            FRONTEND_PORT,
        },

        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );

  frontendStartedByElectron =
    true;

  frontendProcess.stdout?.on(
    "data",
    (
      data: Buffer,
    ) => {
      logFrontendOutput(
        "stdout",
        data,
      );
    },
  );

  frontendProcess.stderr?.on(
    "data",
    (
      data: Buffer,
    ) => {
      logFrontendOutput(
        "stderr",
        data,
      );
    },
  );

  frontendProcess.on(
    "error",
    (
      error,
    ) => {
      console.error(
        "[Electron] Next.js process error:",
        error,
      );
    },
  );

  frontendProcess.on(
    "exit",
    (
      code,
      signal,
    ) => {
      console.log(
        `[Electron] Next.js exited. Code: ${String(
          code,
        )}, signal: ${String(
          signal,
        )}`,
      );

      frontendProcess =
        null;
    },
  );

  await waitForUrl(
    FRONTEND_URL,
    60000,
    500,
  );

  console.log(
    `[Electron] Next.js is ready at ${FRONTEND_URL}`,
  );
}

function stopWindowsProcessTree(
  processId: number,
): Promise<void> {
  return new Promise(
    (
      resolve,
    ) => {
      const taskkillProcess =
        spawn(
          "taskkill",
          [
            "/PID",
            String(
              processId,
            ),
            "/T",
            "/F",
          ],
          {
            windowsHide:
              true,

            stdio:
              "ignore",
          },
        );

      taskkillProcess.on(
        "error",
        () => {
          resolve();
        },
      );

      taskkillProcess.on(
        "exit",
        () => {
          resolve();
        },
      );
    },
  );
}

export async function stopFrontend(): Promise<void> {
  if (
    !frontendStartedByElectron ||
    !frontendProcess
  ) {
    return;
  }

  const processId =
    frontendProcess.pid;

  console.log(
    "[Electron] Stopping Next.js...",
  );

  if (
    process.platform ===
      "win32" &&
    processId
  ) {
    await stopWindowsProcessTree(
      processId,
    );
  } else {
    frontendProcess.kill(
      "SIGTERM",
    );
  }

  frontendProcess =
    null;

  frontendStartedByElectron =
    false;

  console.log(
    "[Electron] Next.js stopped.",
  );
}