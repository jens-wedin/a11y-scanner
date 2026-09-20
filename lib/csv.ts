import type { ScanReport, A11yIssue } from "./types";

/**
 * CSV export of a scan report, one row per issue per affected page.
 *
 * The per-occurrence shape is what makes the file useful in a spreadsheet:
 * filter by URL to hand a developer everything broken on one page, or pivot by
 * severity or WCAG criterion. `occurrenceCount` is deliberately omitted — it is
 * a total across all pages, so on a per-page row it would mislead.
 */

export const CSV_COLUMNS = [
  "url",
  "issue_title",
  "severity",
  "wcag_criterion",
  "wcag_level",
  "eaa_risk",
  "fix_complexity",
  "description",
  "business_impact",
  "recommended_fix",
  "code_example",
  "wcag_doc_url",
  "scan_target",
  "scan_completed_at",
] as const;

/**
 * Excel and Google Sheets evaluate a cell that begins with =, +, - or @ as a
 * formula. `code_example` and `recommended_fix` carry HTML lifted from the
 * scanned site, so without this a hostile page could place a formula in (say)
 * an alt attribute and have it execute on the client's machine when they open
 * a report you emailed them. A leading apostrophe forces text.
 */
function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = neutraliseFormula(raw);

  // Quote when the value contains a delimiter, a quote, or a line break.
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function rowsFor(issue: A11yIssue, report: ScanReport): string[][] {
  // An issue with no recorded pages still belongs in the export; emitting
  // nothing would silently drop a real finding.
  const pages = issue.affectedPages.length > 0 ? issue.affectedPages : [""];

  return pages.map((url) => [
    url,
    issue.title,
    issue.severity,
    issue.wcagCriterion,
    issue.wcagLevel,
    issue.eaaRisk,
    issue.fixComplexity,
    issue.description,
    issue.businessImpact,
    issue.recommendedFix,
    issue.codeExample,
    issue.wcagDocUrl,
    report.targetUrl,
    report.completedAt,
  ]);
}

export function toCsv(report: ScanReport): string {
  const lines: string[] = [CSV_COLUMNS.join(",")];

  for (const issue of report.issues) {
    for (const row of rowsFor(issue, report)) {
      lines.push(row.map(escapeCell).join(","));
    }
  }

  // CRLF is what the CSV spec calls for and what Excel expects. The BOM makes
  // Excel read the file as UTF-8 — without it Swedish characters arrive mangled.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
