import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import PQueue from "p-queue";
import type { RawPageResult } from "./types";

export async function scanPages(
  urls: string[],
  onProgress: (result: RawPageResult) => void,
  headless = true
): Promise<RawPageResult[]> {
  const browser = await chromium.launch({ headless });
  const queue = new PQueue({ concurrency: 3 });
  const results: RawPageResult[] = [];

  try {
    await Promise.all(
      urls.map((url) =>
        queue.add(async () => {
          const context = await browser.newContext();
          const page = await context.newPage();
          try {
            await page.goto(url, {
              waitUntil: "networkidle",
              timeout: 30000,
            });

            const axeResults = await new AxeBuilder({ page })
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
