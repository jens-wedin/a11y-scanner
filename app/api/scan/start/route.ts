import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob, createJob } from "@/lib/queue";
import type { ScanConfig, CrawledUrl } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanId, selectedUrls, config, headless } = body as {
      scanId: string;
      selectedUrls?: string[];
      config?: ScanConfig & { selectedUrls?: string[] };
      headless?: boolean;
    };

    if (!scanId) {
      return NextResponse.json(
        { error: "scanId is required" },
        { status: 400 }
      );
    }

    let job = getJob(scanId);

    // Recreate the job if the in-memory queue was cleared (e.g. dev hot reload)
    if (!job) {
      if (!config || !selectedUrls) {
        return NextResponse.json(
          { error: "Scan job not found and no config provided to recreate it" },
          { status: 404 }
        );
      }
      const crawledUrls: CrawledUrl[] = selectedUrls.map((url) => ({
        url,
        depth: 0,
      }));
      createJob({
        id: scanId,
        status: "pending",
        config,
        startedAt: new Date().toISOString(),
        progress: { scannedCount: 0, totalCount: crawledUrls.length },
        crawledUrls,
        headless: headless ?? true,
      });
      job = getJob(scanId)!;
    }

    if (job.status !== "pending") {
      return NextResponse.json(
        { error: `Job is already in status: ${job.status}` },
        { status: 409 }
      );
    }

    // If user selected a subset of URLs, filter the crawledUrls
    if (selectedUrls && selectedUrls.length > 0 && job.crawledUrls) {
      const selectedSet = new Set(selectedUrls);
      const filtered = job.crawledUrls.filter((u) => selectedSet.has(u.url));
      updateJob(scanId, {
        config: { ...job.config, selectedUrls },
        crawledUrls: filtered,
        progress: { scannedCount: 0, totalCount: filtered.length },
      });
    }

    // Mark as scanning — SSE consumer will start the scan when it connects
    updateJob(scanId, { status: "scanning" });

    return NextResponse.json({ scanId, status: "scanning" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start scan" },
      { status: 500 }
    );
  }
}
