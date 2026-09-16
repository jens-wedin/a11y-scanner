import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { crawl } from "@/lib/crawler";
import { assertScannableUrl, BlockedUrlError } from "@/lib/url-guard";
import { createJob, updateJob } from "@/lib/queue";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetUrl, maxPages, maxDepth } = body as {
      targetUrl: string;
      maxPages: number;
      maxDepth?: number;
    };

    if (!targetUrl) {
      return NextResponse.json(
        { error: "targetUrl is required" },
        { status: 400 }
      );
    }

    // Reject non-public targets before anything is launched (SSRF).
    try {
      await assertScannableUrl(targetUrl);
    } catch (err) {
      if (err instanceof BlockedUrlError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const scanId = uuidv4();

    createJob({
      id: scanId,
      status: "crawling",
      config: { targetUrl, maxPages, maxDepth },
      startedAt: new Date().toISOString(),
      progress: { scannedCount: 0, totalCount: 0 },
    });

    const { urls, headless } = await crawl(targetUrl, maxPages, maxDepth);

    updateJob(scanId, {
      status: "pending",
      crawledUrls: urls,
      headless,
      progress: { scannedCount: 0, totalCount: urls.length },
    });

    return NextResponse.json({ scanId, urls, headless });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Crawl error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crawl failed" },
      { status: 500 }
    );
  }
}
