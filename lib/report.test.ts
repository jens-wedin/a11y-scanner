import { describe, it, expect, beforeEach } from "vitest";
import { saveScanReport, loadScanReport, computeSummary } from "./report";
import { getSql, ensureSchema } from "./db";
import type { ScanReport } from "./types";

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

describe("report persistence (Postgres)", () => {
  beforeEach(async () => {
    await ensureSchema();
    await getSql()`delete from reports`;
  });

  it("round-trips a report", async () => {
    await saveScanReport(VALID_ID, report);
    const loaded = await loadScanReport(VALID_ID);
    expect(loaded?.targetUrl).toBe("https://example.com");
    expect(loaded?.scanId).toBe(VALID_ID);
  });

  it("returns null for an unknown scanId", async () => {
    expect(
      await loadScanReport("55555555-5555-4555-8555-555555555555")
    ).toBeNull();
  });

  it("overwrites an existing report for the same scanId", async () => {
    await saveScanReport(VALID_ID, report);
    await saveScanReport(VALID_ID, { ...report, pagesScanned: 42 });
    expect((await loadScanReport(VALID_ID))?.pagesScanned).toBe(42);
  });

  it("preserves nested issue data through the round-trip", async () => {
    const withIssue: ScanReport = {
      ...report,
      issues: [
        {
          id: "image-alt",
          title: "Images missing alt text",
          description: "d",
          wcagCriterion: "1.1.1 Non-text Content",
          wcagLevel: "A",
          wcagDocUrl: "https://example.com/wcag",
          eaaRisk: "high",
          businessImpact: "b",
          fixComplexity: "low",
          affectedPages: ["https://example.com/"],
          occurrenceCount: 3,
          severity: "critical",
          codeExample: '<img src="a.png">',
          recommendedFix: '<img src="a.png" alt="A">',
        },
      ],
    };
    await saveScanReport(VALID_ID, withIssue);
    const loaded = await loadScanReport(VALID_ID);
    expect(loaded?.issues).toHaveLength(1);
    expect(loaded?.issues[0].codeExample).toBe('<img src="a.png">');
  });

  // SEC-5 held: a scanId reaches storage from a route param.
  it("refuses a non-UUID scanId on read", async () => {
    expect(await loadScanReport("../decoy-secret")).toBeNull();
    expect(await loadScanReport("not-a-uuid")).toBeNull();
  });

  it("refuses a non-UUID scanId on write", async () => {
    await expect(saveScanReport("../decoy-secret", report)).rejects.toThrow();
  });

  it("does not write anything to the local filesystem", async () => {
    const fs = await import("fs");
    const path = await import("path");
    await saveScanReport(VALID_ID, report);
    expect(fs.existsSync(path.join(process.cwd(), "reports", `${VALID_ID}.json`))).toBe(
      false
    );
  });
});

describe("computeSummary", () => {
  it("counts an empty issue list as zero", () => {
    const s = computeSummary([]);
    expect(s.totalIssues).toBe(0);
    expect(s.bySeverity.critical).toBe(0);
  });
});
