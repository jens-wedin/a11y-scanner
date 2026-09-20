import { launchBrowser, createContext, scanConcurrency } from "./browser";
import { assertScannableUrl, BlockedUrlError } from "./url-guard";
import AxeBuilder from "@axe-core/playwright";
import PQueue from "p-queue";
import type { RawPageResult } from "./types";

export async function scanPages(
  urls: string[],
  onProgress: (result: RawPageResult) => void | Promise<void>
): Promise<RawPageResult[]> {
  // The scanner is reachable independently of the crawler (/api/scan/start
  // accepts caller-supplied selectedUrls), so it validates its own input.
  const allowed: string[] = [];
  const rejected: RawPageResult[] = [];

  for (const url of urls) {
    try {
      await assertScannableUrl(url);
      allowed.push(url);
    } catch (err) {
      if (!(err instanceof BlockedUrlError)) throw err;
      rejected.push({
        url,
        violations: [],
        scannedAt: new Date().toISOString(),
        error: err.message,
      });
    }
  }

  for (const result of rejected) await onProgress(result);

  // Nothing survived validation — don't pay for a browser launch.
  if (allowed.length === 0) return rejected;

  const browser = await launchBrowser();
  const queue = new PQueue({ concurrency: scanConcurrency() });
  const results: RawPageResult[] = [...rejected];

  try {
    await Promise.all(
      allowed.map((url) =>
        queue.add(async () => {
          const context = await createContext(browser);
          const page = await context.newPage();
          try {
            await page.goto(url, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const axeResults = await new AxeBuilder({ page: page as any })
              .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "wcag22aa",
              ])
              .analyze();

            const result: RawPageResult = {
              url,
              violations: axeResults.violations.map((v) => ({
                id: v.id,
                impact: v.impact ?? null,
                description: v.description,
                help: v.help,
                helpUrl: v.helpUrl,
                nodes: v.nodes.map((n) => ({
                  html: n.html,
                  target: n.target.map(String),
                  failureSummary: n.failureSummary,
                })),
              })),
              scannedAt: new Date().toISOString(),
            };

            results.push(result);
            await onProgress(result);
          } catch (err) {
            const result: RawPageResult = {
              url,
              violations: [],
              scannedAt: new Date().toISOString(),
              error: err instanceof Error ? err.message : "Scan failed",
            };
            results.push(result);
            await onProgress(result);
          } finally {
            // If the browser already died, closing throws and that throw would
            // replace the real failure with a misleading cleanup error.
            await context.close().catch(() => {});
          }
        })
      )
    );
  } finally {
    await browser.close();
  }

  return results;
}
