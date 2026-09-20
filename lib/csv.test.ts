import { describe, it, expect } from "vitest";
import { toCsv, CSV_COLUMNS } from "./csv";
import { computeSummary } from "./report";
import type { ScanReport, A11yIssue } from "./types";

function issue(overrides: Partial<A11yIssue> = {}): A11yIssue {
  return {
    id: "image-alt",
    title: "Images missing alt text",
    description: "Screen readers cannot describe these images.",
    wcagCriterion: "1.1.1 Non-text Content",
    wcagLevel: "A",
    wcagDocUrl: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content",
    eaaRisk: "high",
    businessImpact: "Screen reader users cannot identify the image.",
    fixComplexity: "low",
    affectedPages: ["https://example.com/", "https://example.com/about"],
    occurrenceCount: 3,
    severity: "critical",
    codeExample: '<img src="a.png">',
    recommendedFix: '<img src="a.png" alt="A">',
    ...overrides,
  };
}

function report(issues: A11yIssue[]): ScanReport {
  return {
    scanId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    targetUrl: "https://example.com",
    startedAt: "2026-09-20T10:00:00.000Z",
    completedAt: "2026-09-20T10:05:00.000Z",
    pagesScanned: 2,
    issues,
    summary: computeSummary(issues),
  };
}

/** Split CSV into rows, respecting quoted fields containing newlines. */
function rows(csv: string): string[] {
  const body = csv.replace(/^﻿/, "");
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"') {
      if (inQuotes && body[i + 1] === '"') { cur += '""'; i++; continue; }
      inQuotes = !inQuotes;
      cur += c;
    } else if (c === "\n" && !inQuotes) {
      out.push(cur.replace(/\r$/, ""));
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

describe("toCsv — structure", () => {
  it("starts with a UTF-8 BOM so Excel renders å ä ö correctly", () => {
    expect(toCsv(report([issue()]))).toMatch(/^﻿/);
  });

  it("emits a header row naming every column", () => {
    const [header] = rows(toCsv(report([])));
    for (const col of CSV_COLUMNS) expect(header).toContain(col);
  });

  it("emits one row per issue per affected page", () => {
    const csv = toCsv(report([issue()]));
    // header + 2 pages
    expect(rows(csv)).toHaveLength(3);
  });

  it("expands several issues across their own pages", () => {
    const csv = toCsv(
      report([
        issue({ affectedPages: ["https://example.com/"] }),
        issue({ id: "contrast", affectedPages: ["https://example.com/a", "https://example.com/b"] }),
      ])
    );
    expect(rows(csv)).toHaveLength(4); // header + 1 + 2
  });

  it("puts the page URL in the first column", () => {
    const [, first] = rows(toCsv(report([issue()])));
    expect(first.startsWith("https://example.com/")).toBe(true);
  });

  it("keeps an issue that affects no pages rather than dropping it", () => {
    const csv = toCsv(report([issue({ affectedPages: [] })]));
    expect(rows(csv)).toHaveLength(2);
    expect(rows(csv)[1]).toContain("Images missing alt text");
  });

  it("returns just the header for a report with no issues", () => {
    expect(rows(toCsv(report([])))).toHaveLength(1);
  });

  it("repeats scan context on every row so the file stands alone", () => {
    for (const row of rows(toCsv(report([issue()]))).slice(1)) {
      expect(row).toContain("https://example.com");
      expect(row).toContain("2026-09-20");
    }
  });
});

describe("toCsv — escaping", () => {
  it("quotes and doubles embedded quotes", () => {
    const csv = toCsv(report([issue({ title: 'He said "hello"' })]));
    expect(csv).toContain('"He said ""hello"""');
  });

  it("quotes values containing commas", () => {
    const csv = toCsv(report([issue({ title: "alt, title and aria" })]));
    expect(csv).toContain('"alt, title and aria"');
  });

  it("quotes values containing newlines without breaking the row count", () => {
    const csv = toCsv(report([issue({ description: "line one\nline two" })]));
    expect(rows(csv)).toHaveLength(3); // header + 2 pages, newline stayed inside a field
  });
});

/** Split one CSV row into unquoted field values. */
function fields(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

describe("toCsv — spreadsheet formula injection", () => {
  // code_example and recommended_fix carry HTML scraped from the target site.
  // Excel and Sheets execute a cell beginning = + - or @, so a hostile page
  // could run a formula on the client's machine when they open the export.
  const dangerous = ['=HYPERLINK("http://evil")', "+1+1", "-1+1", "@SUM(A1)"];

  for (const payload of dangerous) {
    it(`neutralises a cell starting with ${payload[0]}`, () => {
      const csv = toCsv(report([issue({ codeExample: payload })]));
      const cells = fields(rows(csv)[1]);

      // No field may reach the spreadsheet still looking like a formula.
      for (const cell of cells) {
        expect(/^[=+\-@]/.test(cell)).toBe(false);
      }
      // The payload survives as inert text rather than being dropped.
      expect(cells.some((c) => c === `'${payload}`)).toBe(true);
    });
  }

  it("leaves ordinary values untouched", () => {
    const csv = toCsv(report([issue({ title: "Images missing alt text" })]));
    const cells = fields(rows(csv)[1]);
    expect(cells).toContain("Images missing alt text");
  });
});
