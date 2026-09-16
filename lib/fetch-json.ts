/**
 * Client-side JSON fetch with honest error messages.
 *
 * Exists because Vercel Deployment Protection answers an unauthenticated API
 * GET with a 302 to its login page. The browser follows it, so the client sees
 * a 200 with an HTML body — `res.ok` is true and `res.json()` then throws
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, which tells the
 * user nothing about what actually happened.
 */

/** Thrown when a response body is not JSON — usually an auth gate or proxy page. */
export class NotJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotJsonError";
  }
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("json")) {
    const body = await res.text();

    if (body.trimStart().startsWith("<")) {
      throw new NotJsonError(
        "Your session has expired. Reload the page to sign in again, then retry."
      );
    }

    if (!body.trim()) {
      throw new NotJsonError(
        `The server sent an empty response (HTTP ${res.status}). Please try again.`
      );
    }

    throw new NotJsonError(
      `Expected JSON but the server sent ${contentType || "an unknown format"} (HTTP ${res.status}).`
    );
  }

  const body = await res.text();

  if (!body.trim()) {
    throw new NotJsonError(
      `The server sent an empty response (HTTP ${res.status}). Please try again.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new NotJsonError(
      `The server sent a malformed response (HTTP ${res.status}). Please try again.`
    );
  }

  if (!res.ok) {
    const error =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `Request failed (HTTP ${res.status}).`;
    throw new Error(error);
  }

  return parsed as T;
}
