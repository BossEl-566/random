import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { checkUrl, waitForUrl } from "./url-waiter";

const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = "8000";
const BACKEND_HEALTH_URL =
  `http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`;

let backendProcess: ChildProcess | null = null;
let backendStartedByElectron = false;

function getApiDirectory(): string {
  return path.resolve(__dirname, "..", "..", "api");
}

function getPythonExecutable(apiDirectory: string): string {
  if (process.platform === "win32") {
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

function logBackendOutput(
  label: "stdout" | "stderr",
  data: Buffer,
): void {
  const output = data.toString().trim();

  if (!output) {
    return;
  }

  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    console.log(`[FastAPI ${label}] ${line}`);
  }
}

export async function ensureBackendRunning(): Promise<void> {
  const backendAlreadyRunning =
    await checkUrl(BACKEND_HEALTH_URL);

  if (backendAlreadyRunning) {
    console.log(
      `[Electron] FastAPI is already running at ${BACKEND_HEALTH_URL}`,
    );

    backendStartedByElectron = false;
    return;
  }

  const apiDirectory = getApiDirectory();
  const pythonExecutable = getPythonExecutable(apiDirectory);

  if (!fs.existsSync(apiDirectory)) {
    throw new Error(
      `The FastAPI directory was not found: ${apiDirectory}`,
    );
  }

  if (!fs.existsSync(pythonExecutable)) {
    throw new Error(
      [
        "The Python virtual environment was not found.",
        `Expected Python executable: ${pythonExecutable}`,
        "Create the backend virtual environment before starting Electron.",
      ].join(" "),
    );
  }

  console.log("[Electron] Starting the FastAPI backend...");
  console.log(`[Electron] Backend directory: ${apiDirectory}`);

  backendProcess = spawn(
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
      cwd: apiDirectory,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

  backendStartedByElectron = true;

  backendProcess.stdout?.on("data", (data: Buffer) => {
    logBackendOutput("stdout", data);
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    logBackendOutput("stderr", data);
  });

  backendProcess.on("error", (error) => {
    console.error(
      "[Electron] FastAPI process error:",
      error,
    );
  });

  backendProcess.on("exit", (code, signal) => {
    console.log(
      `[Electron] FastAPI exited. Code: ${String(code)}, signal: ${String(signal)}`,
    );

    backendProcess = null;
  });

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
  return new Promise((resolve) => {
    const taskkillProcess = spawn(
      "taskkill",
      [
        "/PID",
        String(processId),
        "/T",
        "/F",
      ],
      {
        windowsHide: true,
        stdio: "ignore",
      },
    );

    taskkillProcess.on("error", () => {
      resolve();
    });

    taskkillProcess.on("exit", () => {
      resolve();
    });
  });
}

export async function stopBackend(): Promise<void> {
  if (
    !backendStartedByElectron ||
    !backendProcess
  ) {
    return;
  }

  const processId = backendProcess.pid;

  console.log("[Electron] Stopping FastAPI...");

  if (
    process.platform === "win32" &&
    processId
  ) {
    await stopWindowsProcessTree(processId);
  } else {
    backendProcess.kill("SIGTERM");
  }

  backendProcess = null;
  backendStartedByElectron = false;

  console.log("[Electron] FastAPI stopped.");
}