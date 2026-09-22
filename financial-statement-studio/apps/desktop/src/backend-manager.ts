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


const BACKEND_HOST =
  "127.0.0.1";

const BACKEND_PORT =
  "8000";

const BACKEND_HEALTH_URL =
  `http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`;


let backendProcess:
  ChildProcess | null = null;

let backendStartedByElectron =
  false;


function getDevelopmentApiDirectory(): string {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "api",
  );
}


function getDevelopmentPythonExecutable(
  apiDirectory: string,
): string {
  if (
    process.platform ===
    "win32"
  ) {
    return path.join(
      apiDirectory,
      ".venv",
      "Scripts",
      "python.exe",
    );
  }

  return path.join(
    apiDirectory,
    ".venv",
    "bin",
    "python",
  );
}


function getPackagedBackendDirectory(): string {
  return path.join(
    process.resourcesPath,
    "backend",
  );
}


function getPackagedBackendExecutable(): string {
  return path.join(
    getPackagedBackendDirectory(),
    "financial-statement-backend.exe",
  );
}


function getProductionDataDirectory(): string {
  return path.join(
    app.getPath(
      "userData",
    ),
    "data",
  );
}


function getProductionDatabaseUrl(
  dataDirectory: string,
): string {
  const databasePath =
    path
      .join(
        dataDirectory,
        "accounting.db",
      )
      .replace(
        /\\/g,
        "/",
      );

  return `sqlite:///${databasePath}`;
}


function logBackendOutput(
  label: "stdout" | "stderr",
  data: Buffer,
): void {
  const output =
    data.toString().trim();

  if (!output) {
    return;
  }

  const lines =
    output.split(
      /\r?\n/,
    );

  for (
    const line of lines
  ) {
    console.log(
      `[FastAPI ${label}] ${line}`,
    );
  }
}


function startDevelopmentBackend(): void {
  const apiDirectory =
    getDevelopmentApiDirectory();

  const pythonExecutable =
    getDevelopmentPythonExecutable(
      apiDirectory,
    );

  if (
    !fs.existsSync(
      apiDirectory,
    )
  ) {
    throw new Error(
      `The FastAPI directory was not found: ${apiDirectory}`,
    );
  }

  if (
    !fs.existsSync(
      pythonExecutable,
    )
  ) {
    throw new Error(
      [
        "The Python virtual environment was not found.",
        `Expected Python executable: ${pythonExecutable}`,
        "Create the backend virtual environment before starting Electron.",
      ].join(" "),
    );
  }

  console.log(
    "[Electron] Starting the FastAPI development backend...",
  );

  console.log(
    `[Electron] Backend directory: ${apiDirectory}`,
  );

  backendProcess =
    spawn(
      pythonExecutable,
      [
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        BACKEND_HOST,
        "--port",
        BACKEND_PORT,
      ],
      {
        cwd:
          apiDirectory,

        windowsHide:
          true,

        env: {
          ...process.env,

          PYTHONUNBUFFERED:
            "1",
        },

        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );
}


function startPackagedBackend(): void {
  const backendDirectory =
    getPackagedBackendDirectory();

  const backendExecutable =
    getPackagedBackendExecutable();

  if (
    !fs.existsSync(
      backendDirectory,
    )
  ) {
    throw new Error(
      [
        "The packaged FastAPI backend directory was not found.",
        `Expected directory: ${backendDirectory}`,
      ].join(" "),
    );
  }

  if (
    !fs.existsSync(
      backendExecutable,
    )
  ) {
    throw new Error(
      [
        "The packaged FastAPI backend executable was not found.",
        `Expected executable: ${backendExecutable}`,
      ].join(" "),
    );
  }

  const dataDirectory =
    getProductionDataDirectory();

  fs.mkdirSync(
    dataDirectory,
    {
      recursive: true,
    },
  );

  const databaseUrl =
    getProductionDatabaseUrl(
      dataDirectory,
    );

  console.log(
    "[Electron] Starting the packaged FastAPI backend...",
  );

  console.log(
    `[Electron] Backend executable: ${backendExecutable}`,
  );

  console.log(
    `[Electron] Application data directory: ${dataDirectory}`,
  );

  backendProcess =
    spawn(
      backendExecutable,
      [],
      {
        cwd:
          backendDirectory,

        windowsHide:
          true,

        env: {
          ...process.env,

          BACKEND_HOST,
          BACKEND_PORT,

          ENVIRONMENT:
            "production",

          DATA_DIR:
            dataDirectory,

          DATABASE_URL:
            databaseUrl,

          PYTHONUNBUFFERED:
            "1",
        },

        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );
}


function registerBackendProcessHandlers(): void {
  backendStartedByElectron =
    true;

  backendProcess?.stdout?.on(
    "data",
    (
      data: Buffer,
    ) => {
      logBackendOutput(
        "stdout",
        data,
      );
    },
  );

  backendProcess?.stderr?.on(
    "data",
    (
      data: Buffer,
    ) => {
      logBackendOutput(
        "stderr",
        data,
      );
    },
  );

  backendProcess?.on(
    "error",
    (
      error,
    ) => {
      console.error(
        "[Electron] FastAPI process error:",
        error,
      );
    },
  );

  backendProcess?.on(
    "exit",
    (
      code,
      signal,
    ) => {
      console.log(
        `[Electron] FastAPI exited. Code: ${String(
          code,
        )}, signal: ${String(
          signal,
        )}`,
      );

      backendProcess =
        null;
    },
  );
}


export async function ensureBackendRunning(): Promise<void> {
  const backendAlreadyRunning =
    await checkUrl(
      BACKEND_HEALTH_URL,
    );

  if (
    backendAlreadyRunning
  ) {
    console.log(
      `[Electron] FastAPI is already running at ${BACKEND_HEALTH_URL}`,
    );

    backendStartedByElectron =
      false;

    return;
  }

  if (
    app.isPackaged
  ) {
    startPackagedBackend();
  } else {
    startDevelopmentBackend();
  }

  registerBackendProcessHandlers();

  await waitForUrl(
    BACKEND_HEALTH_URL,
    30000,
    500,
  );

  console.log(
    `[Electron] FastAPI is ready at ${BACKEND_HEALTH_URL}`,
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


export async function stopBackend(): Promise<void> {
  if (
    !backendStartedByElectron ||
    !backendProcess
  ) {
    return;
  }

  const processId =
    backendProcess.pid;

  console.log(
    "[Electron] Stopping FastAPI...",
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
    backendProcess.kill(
      "SIGTERM",
    );
  }

  backendProcess =
    null;

  backendStartedByElectron =
    false;

  console.log(
    "[Electron] FastAPI stopped.",
  );
}