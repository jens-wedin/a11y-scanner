import {
  launchBrowser,
  createContext,
  scanConcurrency,
  pagesPerBrowser as defaultPagesPerBrowser,
} from "./browser";
import { assertScannableUrl, BlockedUrlError } from "./url-guard";
import AxeBuilder from "@axe-core/playwright";
import PQueue from "p-queue";
import type { RawPageResult } from "./types";

type Browser = Awaited<ReturnType<typeof launchBrowser>>;

export interface ScanOptions {
  /** Injectable for tests, so they never launch a real Chromium. */
  launch?: () => Promise<Browser>;
  /** Relaunch the browser after this many pages. Infinity keeps one browser. */
  pagesPerBrowser?: number;
  /** Tests that use fabricated hostnames skip the SSRF guard. */
  validate?: boolean;
}

export async function scanPages(
  urls: string[],
  onProgress: (result: RawPageResult) => void | Promise<void>,
  options: ScanOptions = {}
): Promise<RawPageResult[]> {
  const launch = options.launch ?? launchBrowser;
  const perBrowser = options.pagesPerBrowser ?? defaultPagesPerBrowser();
  const shouldValidate = options.validate ?? true;

  // The scanner is reachable independently of the crawler (/api/scan/start
  // accepts caller-supplied selectedUrls), so it validates its own input.
  const allowed: string[] = [];
  const rejected: RawPageResult[] = [];

  for (const url of urls) {
    if (!shouldValidate) {
      allowed.push(url);
      continue;
    }
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

  const queue = new PQueue({ concurrency: scanConcurrency() });
  const results: RawPageResult[] = [...rejected];

  /**
   * Browser lifecycle.
   *
   * @sparticuz/chromium runs --single-process, where one bad page takes the
   * whole browser with it and there is no recovery for later pages. So on
   * serverless the browser is recycled per page; locally one browser serves
   * the whole run. A browser that has died is also replaced rather than
   * reused, so a crash costs one page instead of the entire scan.
   */
  let browser: Browser | null = null;
  let pagesOnCurrentBrowser = 0;

  async function disposeBrowser() {
    if (!browser) return;
    const dying = browser;
    browser = null;
    pagesOnCurrentBrowser = 0;
    await dying.close().catch(() => {});
  }

  // Acquisition is serialised. Without this, concurrent pages all observe a
  // null browser at once and each launches its own — three Chromiums instead
  // of the one they are meant to share.
  let acquiring: Promise<void> = Promise.resolve();

  async function getBrowser(): Promise<Browser> {
    const acquire = acquiring.then(async () => {
      const dead = browser && !browser.isConnected();
      if (browser && (dead || pagesOnCurrentBrowser >= perBrowser)) {
        await disposeBrowser();
      }
      if (!browser) {
        browser = await launch();
        pagesOnCurrentBrowser = 0;
      }
      pagesOnCurrentBrowser++;
    });

    // Keep the chain alive even if this acquisition failed.
    acquiring = acquire.catch(() => {});
    await acquire;

    if (!browser) throw new Error("Browser could not be launched");
    return browser;
  }

  async function scanOne(url: string): Promise<RawPageResult> {
    // Everything that can throw lives inside the try, including acquiring the
    // browser and opening the page. Previously those sat outside it, so a dead
    // browser rejected the whole Promise.all and lost every remaining page.
    let context: Awaited<ReturnType<typeof createContext>> | null = null;
    try {
      const current = await getBrowser();
      context = await createContext(current);
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axeResults = await new AxeBuilder({ page: page as any })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      return {
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
    } catch (err) {
      // Only replace the browser if it is the thing that died. A page-level
      // fault — a navigation timeout, a 404 — leaves it perfectly usable, and
      // relaunching for those would cost a Chromium start per bad page.
      if (browser && !browser.isConnected()) {
        await disposeBrowser();
      }
      return {
        url,
        violations: [],
        scannedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Scan failed",
      };
    } finally {
      // Closing throws if the browser has already gone; that throw would
      // replace the real failure with a misleading cleanup error.
      await context?.close().catch(() => {});
    }
  }

  try {
    await Promise.all(
      allowed.map((url) =>
        queue.add(async () => {
          const result = await scanOne(url);
          results.push(result);
          await onProgress(result);
        })
      )
    );
  } finally {
    await disposeBrowser();
  }

  return results;
}
