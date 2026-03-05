import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/queue";
import { loadScanReport } from "@/lib/report";
import { renderPDF } from "@/lib/pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;
  const job = getJob(scanId);
  const report = job?.report ?? loadScanReport(scanId);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  try {
    const pdfBuffer = await renderPDF(report);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="a11y-report-${scanId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
