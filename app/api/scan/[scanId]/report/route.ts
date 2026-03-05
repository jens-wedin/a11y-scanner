import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/queue";
import { loadScanReport } from "@/lib/report";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;
  const job = getJob(scanId);

  if (!job) {
    // Try loading from disk (for reports from previous server restarts)
    const report = loadScanReport(scanId);
    if (!report)
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(report);
  }

  if (job.status !== "done" || !job.report) {
    return NextResponse.json(
      { status: job.status, progress: job.progress },
      { status: 202 }
    );
  }

  return NextResponse.json(job.report);
}
