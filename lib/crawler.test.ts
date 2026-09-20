import { describe, it, expect } from "vitest";
import { crawl, isSameDomain, normalizeUrl, describeBlock } from "./crawler";
import { BlockedUrlError } from "./url-guard";

describe("crawler utils", () => {
  it("isSameDomain: same origin returns true", () => {
    expect(isSameDomain("https://example.com/page", "https://example.com")).toBe(true);
  });

  it("isSameDomain: different origin returns false", () => {
    expect(isSameDomain("https://other.com/page", "https://example.com")).toBe(false);
  });

  it("normalizeUrl: strips hash fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page"
    );
  });

  it("normalizeUrl: strips trailing slash from non-root", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe(
      "https://example.com/page"
    );
  });

  it("normalizeUrl: keeps root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
});

describe("crawl — SSRF guard", () => {
  // These must reject during validation, before any browser is launched.
  // If a browser ever starts here the test will time out, which is the signal.
  const blocked = [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://127.0.0.1:8080/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]:3000/admin",
    "http://192.168.1.1/",
  ];

  for (const url of blocked) {
    it(`refuses to crawl ${url}`, async () => {
      await expect(crawl(url, 10)).rejects.toThrow(BlockedUrlError);
    }, 5000);
  }
});

describe("describeBlock — what a failed crawl tells the user", () => {
  it("explains a 403 as bot protection and points at allowlisting", () => {
    const msg = describeBlock(403, "https://www.example.com/sv");
    expect(msg).toMatch(/403/);
    expect(msg).toMatch(/bot protection|firewall|WAF/i);
    expect(msg).toMatch(/allowlist|permission/i);
    // Must not leak the internal sentinel.
    expect(msg).not.toMatch(/^BLOCKED:/);
  });

  it("explains a 401 as needing credentials, not bot protection", () => {
    const msg = describeBlock(401, "https://example.com");
    expect(msg).toMatch(/401/);
    expect(msg).toMatch(/authenticat|sign|credential/i);
  });

  it("explains a 429 as rate limiting and suggests retrying", () => {
    const msg = describeBlock(429, "https://example.com");
    expect(msg).toMatch(/429|too many/i);
    expect(msg).toMatch(/later|slow|wait/i);
  });

  it("explains a 404 as a wrong URL", () => {
    expect(describeBlock(404, "https://example.com")).toMatch(/404|not found/i);
  });

  it("explains a server error as the site's problem", () => {
    expect(describeBlock(503, "https://example.com")).toMatch(/503|server/i);
  });

  it("explains an unreachable site when there is no status", () => {
    const msg = describeBlock(0, "https://example.com");
    expect(msg).toMatch(/reach|timed out|respond/i);
    expect(msg).not.toMatch(/\b0\b/);
  });

  it("always names the URL that failed", () => {
    for (const status of [0, 401, 403, 404, 429, 503]) {
      expect(describeBlock(status, "https://www.example.com/sv")).toContain(
        "https://www.example.com/sv"
      );
    }
  });
});

describe("crawl — never leaks the internal sentinel", () => {
  it("rejects blocked URLs without a BLOCKED: prefix", async () => {
    await expect(crawl("http://127.0.0.1/", 5)).rejects.not.toThrow(/^BLOCKED:/);
  });
});
