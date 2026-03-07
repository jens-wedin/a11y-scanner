import { NextRequest } from "next/server";
import {
  getJob,
  updateJob,
  addController,
  removeController,
  sendEvent,
  closeStream,
} from "@/lib/queue";
import { scanPages } from "@/lib/scanner";
import { analyzeViolations } from "@/lib/analyzer";
import { saveScanReport, computeSummary } from "@/lib/report";
import type { ScanReport } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;
  const job = getJob(scanId);

  if (!job) {
    return new Response("Scan job not found", { status: 404 });
  }

  // If already done, immediately stream the completed event and close
  if (job.status === "done" && job.report) {
    const data = `data: ${JSON.stringify({
      type: "analysis-complete",
      report: job.report,
    })}\n\n`;
    return new Response(data, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addController(scanId, controller);

      // Only start the scan pipeline if the job is in "scanning" status
      // (set by POST /api/scan/start)
      if (job.status === "scanning") {
        runScan(scanId).catch((err) => {
          sendEvent(scanId, {
            type: "error",
            message: err instanceof Error ? err.message : "Scan failed",
          });
          closeStream(scanId);
        });
      }
    },
    cancel() {
      removeController(scanId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function runScan(scanId: string): Promise<void> {
  const job = getJob(scanId)!;
  const urls = (job.crawledUrls ?? []).map((u) => u.url);

  if (urls.length === 0) {
    const emptyReport: ScanReport = {
      scanId,
      targetUrl: job.config.targetUrl,
      startedAt: job.startedAt,
      completedAt: new Date().toISOString(),
      pagesScanned: 0,
      issues: [],
      summary: computeSummary([]),
    };
    saveScanReport(scanId, emptyReport);
    updateJob(scanId, { status: "done", report: emptyReport });
    sendEvent(scanId, { type: "analysis-complete", report: emptyReport });
    closeStream(scanId);
    return;
  }

  // Phase 1: scan each page with axe-core
  let scannedCount = 0;
  const pageResults = await scanPages(urls, (result) => {
    scannedCount++;
    updateJob(scanId, {
      progress: {
        currentUrl: result.url,
        scannedCount,
        totalCount: urls.length,
      },
    });
    sendEvent(scanId, {
      type: "scan-progress",
      url: result.url,
      violations: result.violations.length,
      scannedCount,
      totalCount: urls.length,
    });
  }, job.headless ?? true);

  // Phase 2: analyse with Claude
  sendEvent(scanId, { type: "analysis-start" });
  updateJob(scanId, { status: "analyzing" });

  const issues = await analyzeViolations(pageResults, job.config.targetUrl);

  // Detect fallback: fallback issues use "See axe-core helpUrl" as wcagCriterion
  const analysisFailed = issues.some(
    (i) => i.wcagCriterion === "See axe-core helpUrl"
  );

  const report: ScanReport = {
    scanId,
    targetUrl: job.config.targetUrl,
    startedAt: job.startedAt,
    completedAt: new Date().toISOString(),
    pagesScanned: pageResults.length,
    issues,
    analysisFailed,
    summary: computeSummary(issues),
  };

  saveScanReport(scanId, report);
  updateJob(scanId, { status: "done", report });
  sendEvent(scanId, { type: "analysis-complete", report });
  closeStream(scanId);
}
