import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { saveScanReport, loadScanReport, computeSummary } from "./report";
import type { ScanReport } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "reports");
const VALID_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const report: ScanReport = {
  scanId: VALID_ID,
  targetUrl: "https://example.com",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  pagesScanned: 1,
  issues: [],
  summary: computeSummary([]),
};

describe("loadScanReport — scanId validation (SEC-5)", () => {
  const decoy = path.join(process.cwd(), "decoy-secret.json");

  beforeEach(() => {
    fs.writeFileSync(decoy, JSON.stringify({ secret: "leaked" }), "utf-8");
  });

  afterEach(() => {
    if (fs.existsSync(decoy)) fs.unlinkSync(decoy);
    const saved = path.join(REPORTS_DIR, `${VALID_ID}.json`);
    if (fs.existsSync(saved)) fs.unlinkSync(saved);
  });

  it("refuses a scanId that traverses out of the reports directory", () => {
    expect(loadScanReport("../decoy-secret")).toBeNull();
  });

  it("refuses a deeper traversal", () => {
    expect(loadScanReport("../../../../etc/hosts")).toBeNull();
  });

  it("refuses an absolute path", () => {
    expect(loadScanReport("/etc/hosts")).toBeNull();
  });

  it("refuses a non-UUID id", () => {
    expect(loadScanReport("not-a-uuid")).toBeNull();
  });

  it("still loads a report saved under a valid UUID", () => {
    saveScanReport(VALID_ID, report);
    expect(loadScanReport(VALID_ID)?.targetUrl).toBe("https://example.com");
  });

  it("refuses to save under a traversing scanId", () => {
    expect(() => saveScanReport("../decoy-secret", report)).toThrow();
    // the decoy must still hold its original contents
    expect(JSON.parse(fs.readFileSync(decoy, "utf-8"))).toEqual({
      secret: "leaked",
    });
  });
});
