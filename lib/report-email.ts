import type { ScanReport } from "./types";

const severityColor: Record<string, string> = {
  critical: "#dc2626",
  serious: "#ea580c",
  moderate: "#ca8a04",
  minor: "#2563eb",
};

function header(report: ScanReport): string {
  const date = new Date(report.completedAt).toLocaleDateString("en-GB", {
    dateStyle: "long",
  });
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">Accessibility Report</h1>
      <p style="color: #666; margin: 0 0 20px;">${report.targetUrl} &middot; ${date}</p>
  `;
}

function summaryBlock(report: ScanReport): string {
  const s = report.summary;
  return `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px; background: #fef2f2; border-radius: 8px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${s.bySeverity.critical}</div>
          <div style="font-size: 12px; color: #666;">Critical</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 12px; background: #fff7ed; border-radius: 8px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: bold; color: #ea580c;">${s.bySeverity.serious}</div>
          <div style="font-size: 12px; color: #666;">Serious</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 12px; background: #fefce8; border-radius: 8px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: bold; color: #ca8a04;">${s.bySeverity.moderate}</div>
          <div style="font-size: 12px; color: #666;">Moderate</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 12px; background: #eff6ff; border-radius: 8px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${s.bySeverity.minor}</div>
          <div style="font-size: 12px; color: #666;">Minor</div>
        </td>
      </tr>
    </table>
    <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
      <strong>${s.totalIssues}</strong> issues found across <strong>${report.pagesScanned}</strong> pages
    </p>
  `;
}

function footer(report: ScanReport): string {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  return `
      <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #999; font-size: 12px;">
        Sent from <a href="${baseUrl}/report/${report.scanId}" style="color: #4f46e5;">A11y Scanner</a>
      </p>
    </div>
  `;
}

/** Full HTML email with issue list — used for "embed" format */
export function buildReportEmailHtml(report: ScanReport): string {
  const issueRows = report.issues
    .map((issue) => {
      const color = severityColor[issue.severity] || "#666";
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">
            <div style="font-weight: 600; font-size: 14px;">${issue.title}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">${issue.wcagCriterion} · ${issue.affectedPages.length} page${issue.affectedPages.length !== 1 ? "s" : ""}</div>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: white; background: ${color};">
              ${issue.severity}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    ${header(report)}
    ${summaryBlock(report)}
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #666; font-weight: 600;">Issue</th>
          <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #666; font-weight: 600;">Severity</th>
        </tr>
      </thead>
      <tbody>
        ${issueRows}
      </tbody>
    </table>
    ${footer(report)}
  `;
}

/** Brief summary HTML — used when report is attached as PDF/JSON */
export function buildReportSummaryHtml(report: ScanReport): string {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  return `
    ${header(report)}
    ${summaryBlock(report)}
    <p style="font-size: 14px;">
      The full report is attached to this email. You can also
      <a href="${baseUrl}/report/${report.scanId}" style="color: #4f46e5;">view it online</a>.
    </p>
    ${footer(report)}
  `;
}
