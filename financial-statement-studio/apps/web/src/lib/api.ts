import type { ApiHealthResponse } from "@/types/api";

const DEFAULT_API_URL = "http://127.0.0.1:8000";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? DEFAULT_API_URL;

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { timeoutMs = 8000, headers, ...requestOptions } = options;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}.`;

      try {
        const errorBody = (await response.json()) as {
          detail?: string;
          message?: string;
        };

        errorMessage =
          errorBody.detail ??
          errorBody.message ??
          errorMessage;
      } catch {
        // Keep the default message when the response is not JSON.
      }

      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
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
    window.clearTimeout(timeoutId);
  }
}

export async function getApiHealth(): Promise<ApiHealthResponse> {
  return apiRequest<ApiHealthResponse>("/api/health");
}