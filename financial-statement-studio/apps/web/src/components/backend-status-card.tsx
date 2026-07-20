"use client";

import { useCallback, useEffect, useState } from "react";

import { API_URL, getApiHealth } from "@/lib/api";
import type { ApiConnectionState } from "@/types/api";

const initialState: ApiConnectionState = {
  status: "loading",
  data: null,
  message: "Checking the accounting backend...",
};

function formatTimestamp(timestamp: string): string {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(parsedDate);
}

export function BackendStatusCard() {
  const [connection, setConnection] =
    useState<ApiConnectionState>(initialState);

  const checkConnection = useCallback(async () => {
    setConnection({
      status: "loading",
      data: null,
      message: "Checking the accounting backend...",
    });

    try {
      const health = await getApiHealth();

      setConnection({
        status: "connected",
        data: health,
        message: "Frontend and backend are connected successfully.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unknown connection error occurred.";

      setConnection({
        status: "error",
        data: null,
        message,
      });
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const statusLabel =
    connection.status === "connected"
      ? "Connected"
      : connection.status === "error"
        ? "Disconnected"
        : "Checking";

  return (
    <section
      className={`status-card status-card--${connection.status}`}
      aria-live="polite"
    >
      <div className="status-card__header">
        <div>
          <p className="eyebrow">System connection</p>
          <h2>Accounting backend</h2>
        </div>

        <div className="status-badge">
          <span className="status-badge__dot" />
          {statusLabel}
        </div>
      </div>

      <p className="status-card__message">{connection.message}</p>

      <dl className="status-details">
        <div>
          <dt>API address</dt>
          <dd>{API_URL}</dd>
        </div>

        <div>
          <dt>Application</dt>
          <dd>
            {connection.data?.application ?? "Waiting for response"}
          </dd>
        </div>

        <div>
          <dt>Environment</dt>
          <dd>
            {connection.data?.environment ?? "Not available"}
          </dd>
        </div>

        <div>
          <dt>Database</dt>
          <dd>
            {connection.data?.database ?? "Not confirmed"}
          </dd>
        </div>

        <div>
          <dt>Last response</dt>
          <dd>
            {connection.data
              ? formatTimestamp(connection.data.timestamp)
              : "Not available"}
          </dd>
        </div>
      </dl>

      <button
        className="secondary-button"
        type="button"
        onClick={() => void checkConnection()}
        disabled={connection.status === "loading"}
      >
        {connection.status === "loading"
          ? "Checking connection..."
          : "Check again"}
      </button>
    </section>
  );
}