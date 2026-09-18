import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson, NotJsonError } from "./fetch-json";

function mockResponse(
  body: string,
  { status = 200, contentType = "application/json", url = "http://localhost:3000/api/x" } = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  } as unknown as Response;
}

function stubFetch(res: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => res));
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchJson", () => {
  it("returns parsed JSON on a successful response", async () => {
    stubFetch(mockResponse('{"scanId":"abc","urls":[]}'));
    await expect(fetchJson("/api/crawl")).resolves.toEqual({ scanId: "abc", urls: [] });
  });

  it("throws the server's error message on a JSON error response", async () => {
    stubFetch(mockResponse('{"error":"targetUrl is required"}', { status: 400 }));
    await expect(fetchJson("/api/crawl")).rejects.toThrow("targetUrl is required");
  });

  // The deployment-protection case: Vercel 302s to its login page, the browser
  // follows it, and the body is HTML with a 200 status — so res.ok is true.
  it("throws a sign-in message when an auth gate returns HTML", async () => {
    stubFetch(
      mockResponse("<!DOCTYPE html><html>login</html>", {
        status: 200,
        contentType: "text/html; charset=utf-8",
        url: "https://vercel.com/sso-api?url=...",
      })
    );

    await expect(fetchJson("/api/schedules")).rejects.toThrow(NotJsonError);
    await expect(fetchJson("/api/schedules")).rejects.toThrow(/sign in|session/i);
  });

  it("does not surface a raw JSON parse error to the user", async () => {
    stubFetch(
      mockResponse("<!DOCTYPE html><html>login</html>", {
        contentType: "text/html",
        url: "https://vercel.com/sso-api",
      })
    );
    await expect(fetchJson("/api/schedules")).rejects.not.toThrow(/Unexpected token|Unrecognized token/);
  });

  it("gives a clear message on an empty body rather than a parse error", async () => {
    stubFetch(mockResponse("", { status: 500 }));
    await expect(fetchJson("/api/schedules")).rejects.toThrow(/empty|no response/i);
  });

  it("falls back to the status code when an error body has no error field", async () => {
    stubFetch(mockResponse('{"weird":true}', { status: 503 }));
    await expect(fetchJson("/api/x")).rejects.toThrow(/503/);
  });
});

describe("fetchJson — distinguishing an auth gate from a server error", () => {
  const HTML = "<!DOCTYPE html><html><body>whatever</body></html>";

  // Regression: a Vercel 500 error page is HTML too. Reporting it as an expired
  // session sent the user to re-authenticate while a function was crashing.
  it("reports a server error, not a session problem, for a same-origin 5xx HTML page", async () => {
    stubFetch(
      mockResponse(HTML, {
        status: 500,
        contentType: "text/html",
        url: "http://localhost:3000/api/crawl",
      })
    );
    await expect(fetchJson("/api/crawl")).rejects.toThrow(/server error|500/i);
    await expect(fetchJson("/api/crawl")).rejects.not.toThrow(/sign in|session/i);
  });

  it("still reports a session problem when redirected off-origin", async () => {
    stubFetch(
      mockResponse(HTML, {
        status: 200,
        contentType: "text/html",
        url: "https://vercel.com/sso-api?url=...",
      })
    );
    await expect(fetchJson("/api/crawl")).rejects.toThrow(/sign in|session/i);
  });

  it("reports a session problem on a same-origin 401 HTML page", async () => {
    stubFetch(
      mockResponse(HTML, {
        status: 401,
        contentType: "text/html",
        url: "http://localhost:3000/api/crawl",
      })
    );
    await expect(fetchJson("/api/crawl")).rejects.toThrow(/sign in|session/i);
  });
});
