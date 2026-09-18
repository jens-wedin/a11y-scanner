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

/**
 * True when the response looks like an authentication gate rather than the app.
 *
 * Two signals: an explicit 401/403, or a redirect that landed on another origin
 * (Vercel Deployment Protection sends the browser to vercel.com/sso-api, and
 * the browser follows it, so the final status is 200 on a foreign host).
 */
function isAuthGate(res: Response): boolean {
  if (res.status === 401 || res.status === 403) return true;

  try {
    if (typeof window !== "undefined" && res.url) {
      return new URL(res.url).origin !== window.location.origin;
    }
  } catch {
    // Unparseable URL — fall through to "not an auth gate".
  }

  return false;
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
      // An HTML body is ambiguous: it can be an auth gate's login page, but a
      // crashing function also returns Vercel's HTML error page. Blaming the
      // session for a 500 sends people to re-authenticate for no reason.
      if (isAuthGate(res)) {
        throw new NotJsonError(
          "Your session has expired. Reload the page to sign in again, then retry."
        );
      }

      throw new NotJsonError(
        `The server returned an error page (HTTP ${res.status}). Something failed ` +
          `server-side — check the deployment logs.`
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
