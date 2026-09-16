import { describe, it, expect } from "vitest";
import { crawl, isSameDomain, normalizeUrl } from "./crawler";
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
