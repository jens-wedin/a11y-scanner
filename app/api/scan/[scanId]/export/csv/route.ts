import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/queue";
import { loadScanReport } from "@/lib/report";
import { toCsv } from "@/lib/csv";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;
  const job = await getJob(scanId);
  const report = job?.report ?? (await loadScanReport(scanId));

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return new NextResponse(toCsv(report), {
    headers: {
      // charset matters: the BOM plus this is what makes Excel read UTF-8.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="a11y-report-${scanId.slice(0, 8)}.csv"`,
    },
  });
}
