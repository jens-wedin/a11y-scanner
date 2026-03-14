import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/queue";
import { loadScanReport } from "@/lib/report";
import { renderPDF } from "@/lib/pdf";
import { getResendClient, getResendFrom } from "@/lib/resend";
import {
  buildReportEmailHtml,
  buildReportSummaryHtml,
} from "@/lib/report-email";

const VALID_FORMATS = ["embed", "pdf", "json", "pdf+json"] as const;
type EmailFormat = (typeof VALID_FORMATS)[number];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;

  // Validate Resend config
  const from = getResendFrom();
  const client = getResendClient();
  if (!from || !client) {
    return NextResponse.json(
      { error: "Email sending is not configured. Set RESEND_API_KEY and RESEND_FROM environment variables." },
      { status: 503 }
    );
  }

  // Parse body
  let body: { to?: string; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, format } = body;

  if (!to || !isValidEmail(to)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 }
    );
  }

  if (!format || !VALID_FORMATS.includes(format as EmailFormat)) {
    return NextResponse.json(
      { error: `Format must be one of: ${VALID_FORMATS.join(", ")}` },
      { status: 400 }
    );
  }

  // Load report
  const job = getJob(scanId);
  const report = job?.report ?? loadScanReport(scanId);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Build email
  const subject = `Accessibility Report: ${report.targetUrl}`;
  const attachments: { filename: string; content: Buffer | string }[] = [];

  let html: string;
  if (format === "embed") {
    html = buildReportEmailHtml(report);
  } else {
    html = buildReportSummaryHtml(report);

    if (format === "pdf" || format === "pdf+json") {
      const pdfBuffer = await renderPDF(report);
      attachments.push({
        filename: `a11y-report-${scanId.slice(0, 8)}.pdf`,
        content: Buffer.from(pdfBuffer),
      });
    }

    if (format === "json" || format === "pdf+json") {
      attachments.push({
        filename: `a11y-report-${scanId.slice(0, 8)}.json`,
        content: Buffer.from(JSON.stringify(report, null, 2)),
      });
    }
  }

  try {
    await client.emails.send({
      from,
      to,
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[email] Send failed:", err);
    return NextResponse.json(
      { error: "Failed to send email. Please try again." },
      { status: 500 }
    );
  }
}
