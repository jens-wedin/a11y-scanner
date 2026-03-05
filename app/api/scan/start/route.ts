import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/queue";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanId, selectedUrls } = body as {
      scanId: string;
      selectedUrls?: string[];
    };

    if (!scanId) {
      return NextResponse.json(
        { error: "scanId is required" },
        { status: 400 }
      );
    }

    const job = getJob(scanId);
    if (!job) {
      return NextResponse.json(
        { error: "Scan job not found" },
        { status: 404 }
      );
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
