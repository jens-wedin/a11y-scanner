import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/queue";
import { loadScanReport } from "@/lib/report";

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

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="a11y-report-${scanId.slice(0, 8)}.json"`,
    },
  });
}
