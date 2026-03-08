import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import PQueue from "p-queue";
import type { RawPageResult } from "./types";

export async function scanPages(
  urls: string[],
  onProgress: (result: RawPageResult) => void,
  headless = true
): Promise<RawPageResult[]> {
  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  // Reduce concurrency to 1 when using a visible browser to avoid opening
  // multiple Chrome windows simultaneously
  const queue = new PQueue({ concurrency: headless ? 3 : 1 });
  const results: RawPageResult[] = [];

  try {
    await Promise.all(
      urls.map((url) =>
        queue.add(async () => {
          const context = await browser.newContext({
            userAgent:
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport: { width: 1280, height: 720 },
            locale: "en-US",
            extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
          });
          await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", {
              get: () => undefined,
            });
          });
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
            onProgress(result);
          } catch (err) {
            const result: RawPageResult = {
              url,
              violations: [],
              scannedAt: new Date().toISOString(),
              error: err instanceof Error ? err.message : "Scan failed",
            };
            results.push(result);
            onProgress(result);
          } finally {
            await context.close();
          }
        })
      )
    );
  } finally {
    await browser.close();
  }

  return results;
}
