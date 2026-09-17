import { getSql, ensureSchema } from "./db";
import type { ScanReport, A11yIssue } from "./types";

/**
 * Reports live in Postgres rather than reports/*.json — Vercel's filesystem is
 * read-only outside /tmp and is not shared between instances.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scan IDs arrive from route params. The storage layer no longer builds a file
 * path, so traversal is structurally impossible — but validating keeps the
 * failure mode a clean null rather than a Postgres type error.
 */
function isValidScanId(scanId: string): boolean {
  return UUID_RE.test(scanId);
}

export async function saveScanReport(
  scanId: string,
  report: ScanReport
): Promise<void> {
  if (!isValidScanId(scanId)) {
    throw new Error(`Refusing to store a report under an invalid scanId: ${scanId}`);
  }
  await ensureSchema();
  await getSql()`
    insert into reports (scan_id, data)
    values (${scanId}, ${JSON.stringify(report)})
    on conflict (scan_id) do update set data = excluded.data
  `;
}

export async function loadScanReport(
  scanId: string
): Promise<ScanReport | null> {
  if (!isValidScanId(scanId)) return null;
  await ensureSchema();
  const rows = await getSql()`select data from reports where scan_id = ${scanId}`;
  return rows.length ? (rows[0].data as ScanReport) : null;
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
