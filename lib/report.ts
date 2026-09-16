import * as fs from "fs";
import * as path from "path";
import type { ScanReport, A11yIssue } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "reports");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scan IDs come from route params and are used to build a file path, so they
 * are constrained to the UUID shape the app actually generates. Anything else
 * — traversal, absolute paths, arbitrary names — is refused.
 */
function isValidScanId(scanId: string): boolean {
  return UUID_RE.test(scanId);
}

export function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export function saveScanReport(scanId: string, report: ScanReport): void {
  if (!isValidScanId(scanId)) {
    throw new Error(`Refusing to write a report under an invalid scanId: ${scanId}`);
  }
  ensureReportsDir();
  fs.writeFileSync(
    path.join(REPORTS_DIR, `${scanId}.json`),
    JSON.stringify(report, null, 2),
    "utf-8"
  );
}

export function loadScanReport(scanId: string): ScanReport | null {
  if (!isValidScanId(scanId)) return null;
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
