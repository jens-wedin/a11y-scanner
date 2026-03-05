import * as fs from "fs";
import * as path from "path";
import type { ScanReport, A11yIssue } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "reports");

export function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export function saveScanReport(scanId: string, report: ScanReport): void {
  ensureReportsDir();
  fs.writeFileSync(
    path.join(REPORTS_DIR, `${scanId}.json`),
    JSON.stringify(report, null, 2),
    "utf-8"
  );
}

export function loadScanReport(scanId: string): ScanReport | null {
  const filePath = path.join(REPORTS_DIR, `${scanId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ScanReport;
}

export function computeSummary(issues: A11yIssue[]): ScanReport["summary"] {
  return {
    totalIssues: issues.length,
    byLevel: {
      A: issues.filter((i) => i.wcagLevel === "A").length,
      AA: issues.filter((i) => i.wcagLevel === "AA").length,
      AAA: issues.filter((i) => i.wcagLevel === "AAA").length,
    },
    bySeverity: {
      critical: issues.filter((i) => i.severity === "critical").length,
      serious: issues.filter((i) => i.severity === "serious").length,
      moderate: issues.filter((i) => i.severity === "moderate").length,
      minor: issues.filter((i) => i.severity === "minor").length,
    },
    eaaHighRisk: issues.filter((i) => i.eaaRisk === "high").length,
  };
}
