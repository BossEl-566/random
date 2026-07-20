import http from "node:http";
import https from "node:https";

export function checkUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    let completed = false;

    const finish = (result: boolean) => {
      if (completed) {
        return;
      }

      completed = true;
      resolve(result);
    };

    const request = client.get(
      url,
      {
        timeout: 1500,
      },
      (response) => {
        response.resume();

        const statusCode = response.statusCode ?? 500;
        finish(statusCode >= 200 && statusCode < 500);
      },
    );

    request.on("timeout", () => {
      request.destroy();
      finish(false);
    });

    request.on("error", () => {
      finish(false);
    });
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function waitForUrl(
  url: string,
  timeoutMs = 30000,
  intervalMs = 500,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await checkUrl(url)) {
      return;
    }

    await delay(intervalMs);
  }

  throw new Error(
    `The service at ${url} did not become available within ${timeoutMs} milliseconds.`,
  );
}