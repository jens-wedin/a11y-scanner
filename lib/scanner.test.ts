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
      (r) => seen.push(r)
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
