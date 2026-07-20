"use client";

import {
  useSyncExternalStore,
} from "react";

type DesktopInformation = {
  isElectron: boolean;
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
};

/*
 * Electron information does not currently emit change events.
 * This stable subscription therefore returns only a cleanup function.
 */
function subscribeToDesktopInformation(
  _onStoreChange: () => void,
): () => void {
  return () => undefined;
}

function getDesktopInformationSnapshot():
  | DesktopInformation
  | null {
  return window.desktopAPI ?? null;
}

/*
 * During server rendering and hydration, Electron's window API is not
 * available. Returning null keeps the server and initial client output
 * consistent.
 */
function getServerDesktopInformationSnapshot(): null {
  return null;
}

function getPlatformName(
  platform: string,
): string {
  const platformNames: Record<
    string,
    string
  > = {
    win32: "Windows",
    darwin: "macOS",
    linux: "Linux",
  };

  return (
    platformNames[platform] ??
    platform
  );
}

export function DesktopStatusCard() {
  const desktopInformation =
    useSyncExternalStore(
      subscribeToDesktopInformation,
      getDesktopInformationSnapshot,
      getServerDesktopInformationSnapshot,
    );

  const isDesktop =
    desktopInformation?.isElectron === true;

  const statusLabel = isDesktop
    ? "Desktop active"
    : "Browser mode";

  return (
    <section
      className={`status-card ${
        isDesktop
          ? "status-card--connected"
          : "status-card--loading"
      }`}
      aria-live="polite"
    >
      <div className="status-card__header">
        <div>
          <p className="eyebrow">
            Desktop environment
          </p>

          <h2>
            Electron application shell
          </h2>
        </div>

        <div className="status-badge">
          <span className="status-badge__dot" />
          {statusLabel}
        </div>
      </div>

      <p className="status-card__message">
        {isDesktop
          ? "The Next.js interface is running inside the Electron desktop application."
          : "Open the project through Electron to activate desktop features."}
      </p>

      <dl className="status-details">
        <div>
          <dt>Application mode</dt>
          <dd>
            {isDesktop
              ? "Electron desktop"
              : "Web browser"}
          </dd>
        </div>

        <div>
          <dt>Operating system</dt>
          <dd>
            {desktopInformation
              ? getPlatformName(
                  desktopInformation.platform,
                )
              : "Not available"}
          </dd>
        </div>

        <div>
          <dt>Electron</dt>
          <dd>
            {desktopInformation?.versions
              .electron ?? "Not available"}
          </dd>
        </div>

        <div>
          <dt>Chromium</dt>
          <dd>
            {desktopInformation?.versions
              .chrome ?? "Not available"}
          </dd>
        </div>

        <div>
          <dt>Node.js</dt>
          <dd>
            {desktopInformation?.versions
              .node ?? "Not available"}
          </dd>
        </div>
      </dl>
    </section>
  );
}