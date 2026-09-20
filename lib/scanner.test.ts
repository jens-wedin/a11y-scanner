import { describe, it, expect } from "vitest";
import { scanPages } from "./scanner";
import type { RawPageResult } from "./types";

describe("scanPages — SSRF guard", () => {
  // /api/scan/start accepts caller-supplied selectedUrls, so the scanner is a
  // second entry point and must validate independently of the crawler.
  // All URLs here are blocked, so no browser should ever launch — if one does,
  // the test times out, which is the signal.
  it("refuses blocked URLs and reports them as errors", async () => {
    const seen: RawPageResult[] = [];

    const results = await scanPages(
      [
        "file:///etc/passwd",
        "http://169.254.169.254/latest/meta-data/",
        "http://127.0.0.1:6379/",
      ],
      (r) => { seen.push(r); }
    );

    expect(results).toHaveLength(3);
    expect(seen).toHaveLength(3);
    for (const r of results) {
      expect(r.violations).toEqual([]);
      expect(r.error).toMatch(/blocked|private|scheme|reserved/i);
    }
  }, 5000);

  it("returns no results for an empty URL list", async () => {
    const results = await scanPages([], () => {});
    expect(results).toEqual([]);
  }, 5000);
});

// A stand-in browser so these tests never launch Chromium.
function fakeBrowser(behaviour: { failNewPage?: boolean } = {}) {
  return {
    isConnected: () => true,
    close: async () => {},
    newContext: async () => ({
      close: async () => {},
      newPage: async () => {
        if (behaviour.failNewPage) {
          throw new Error(
            "browserContext.newPage: Target page, context or browser has been closed"
          );
        }
        return {
          goto: async () => {},
          title: async () => "t",
        };
      },
    }),
  } as never;
}

describe("scanPages — resilience (serverless single-process Chromium)", () => {
  const urls = ["https://a.example/", "https://b.example/", "https://c.example/"];

  it("records a per-page error instead of aborting the whole scan", async () => {
    const seen: RawPageResult[] = [];

    const results = await scanPages(urls, (r) => { seen.push(r); }, {
      launch: async () => fakeBrowser({ failNewPage: true }),
      validate: false,
    });

    // Every URL must be accounted for, not just the one that failed.
    expect(results).toHaveLength(3);
    expect(seen).toHaveLength(3);
    for (const r of results) {
      expect(r.error).toMatch(/closed|newPage/i);
    }
  }, 10000);

  it("launches a fresh browser per page when pagesPerBrowser is 1", async () => {
    let launches = 0;

    await scanPages(urls, () => {}, {
      launch: async () => { launches++; return fakeBrowser(); },
      pagesPerBrowser: 1,
      validate: false,
    });

    expect(launches).toBe(3);
  }, 10000);

  it("reuses one browser when pagesPerBrowser is unlimited", async () => {
    let launches = 0;

    await scanPages(urls, () => {}, {
      launch: async () => { launches++; return fakeBrowser(); },
      pagesPerBrowser: Infinity,
      validate: false,
    });

    expect(launches).toBe(1);
  }, 10000);
});
