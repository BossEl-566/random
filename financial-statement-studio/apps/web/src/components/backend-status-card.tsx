"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  API_URL,
  getApiHealth,
} from "@/lib/api";
import type {
  ApiConnectionState,
  ApiHealthResponse,
} from "@/types/api";

const initialState: ApiConnectionState = {
  status: "loading",
  data: null,
  message: "Checking the accounting backend...",
};

function formatTimestamp(
  timestamp: string,
): string {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(parsedDate);
}

function createConnectedState(
  health: ApiHealthResponse,
): ApiConnectionState {
  return {
    status: "connected",
    data: health,
    message:
      "Frontend and backend are connected successfully.",
  };
}

function createErrorState(
  error: unknown,
): ApiConnectionState {
  return {
    status: "error",
    data: null,
    message:
      error instanceof Error
        ? error.message
        : "An unknown connection error occurred.",
  };
}

export function BackendStatusCard() {
  const [connection, setConnection] =
    useState<ApiConnectionState>(
      initialState,
    );

  /*
   * Initial backend request.
   *
   * The Effect starts an external network request. State is changed only
   * after the Promise resolves or rejects, rather than synchronously in
   * the Effect body.
   */
  useEffect(() => {
    let cancelled = false;

    getApiHealth()
      .then((health) => {
        if (cancelled) {
          return;
        }

        setConnection(
          createConnectedState(health),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setConnection(
          createErrorState(error),
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Manual retry.
   *
   * This function is called from a button event, so setting the loading
   * state immediately is appropriate.
   */
  const checkConnection =
    useCallback(async () => {
      setConnection({
        status: "loading",
        data: null,
        message:
          "Checking the accounting backend...",
      });

      try {
        const health =
          await getApiHealth();

        setConnection(
          createConnectedState(health),
        );
      } catch (error) {
        setConnection(
          createErrorState(error),
        );
      }
    }, []);

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
          <p className="eyebrow">
            System connection
          </p>

          <h2>Accounting backend</h2>
        </div>

        <div className="status-badge">
          <span className="status-badge__dot" />
          {statusLabel}
        </div>
      </div>

      <p className="status-card__message">
        {connection.message}
      </p>

      <dl className="status-details">
        <div>
          <dt>API address</dt>
          <dd>{API_URL}</dd>
        </div>

        <div>
          <dt>Application</dt>
          <dd>
            {connection.data?.application ??
              "Waiting for response"}
          </dd>
        </div>

        <div>
          <dt>Environment</dt>
          <dd>
            {connection.data?.environment ??
              "Not available"}
          </dd>
        </div>

        <div>
          <dt>Database</dt>
          <dd>
            {connection.data?.database ??
              "Not confirmed"}
          </dd>
        </div>

        <div>
          <dt>Last response</dt>
          <dd>
            {connection.data
              ? formatTimestamp(
                  connection.data.timestamp,
                )
              : "Not available"}
          </dd>
        </div>
      </dl>

      <button
        className="secondary-button"
        type="button"
        disabled={
          connection.status === "loading"
        }
        onClick={() => {
          void checkConnection();
        }}
      >
        {connection.status === "loading"
          ? "Checking connection..."
          : "Check again"}
      </button>
    </section>
  );
}