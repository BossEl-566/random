import type { ApiHealthResponse } from "@/types/api";

const DEFAULT_API_URL = "http://127.0.0.1:8000";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  DEFAULT_API_URL;

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValidationDetail(
  detail: unknown,
): string | null {
  if (typeof detail === "string") {
    return detail;
  }

  if (!Array.isArray(detail)) {
    return null;
  }

  const messages = detail
    .map((issue) => {
      if (!isRecord(issue)) {
        return null;
      }

      const message =
        typeof issue.msg === "string"
          ? issue.msg
          : "Invalid value.";

      const location = Array.isArray(issue.loc)
        ? issue.loc
            .filter(
              (
                item,
              ): item is string | number =>
                typeof item === "string" ||
                typeof item === "number",
            )
            .slice(1)
            .join(".")
        : "";

      return location
        ? `${location}: ${message}`
        : message;
    })
    .filter(
      (message): message is string =>
        message !== null,
    );

  return messages.length > 0
    ? messages.join(" ")
    : null;
}

async function readErrorMessage(
  response: Response,
): Promise<string> {
  const fallbackMessage =
    `Request failed with status ${response.status}.`;

  try {
    const responseBody: unknown =
      await response.json();

    if (!isRecord(responseBody)) {
      return fallbackMessage;
    }

    const detailMessage =
      formatValidationDetail(
        responseBody.detail,
      );

    if (detailMessage) {
      return detailMessage;
    }

    if (
      typeof responseBody.message === "string"
    ) {
      return responseBody.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    timeoutMs = 8000,
    headers,
    ...requestOptions
  } = options;

  const controller = new AbortController();

  const timeoutId = globalThis.setTimeout(
    () => {
      controller.abort();
    },
    timeoutMs,
  );

  const requestHeaders = new Headers(
    headers,
  );

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set(
      "Accept",
      "application/json",
    );
  }

  if (
    requestOptions.body &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set(
      "Content-Type",
      "application/json",
    );
  }

  try {
    const response = await fetch(
      `${API_URL}${path}`,
      {
        ...requestOptions,
        headers: requestHeaders,
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response),
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The backend did not respond in time. Confirm that FastAPI is running.",
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Unable to connect to the accounting backend. Confirm that FastAPI is running on port 8000.",
      );
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function getApiHealth(): Promise<ApiHealthResponse> {
  return apiRequest<ApiHealthResponse>(
    "/api/health",
  );
}