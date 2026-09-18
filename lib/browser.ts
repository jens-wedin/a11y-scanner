/**
 * Identifies the scanner honestly. Site owners who want to allow it can match
 * on this string; site owners who want to block it can, too. That is the point.
 */
export const USER_AGENT =
  "A11yScanner/0.7 (+https://studiomanfred.com/a11y-scanner; accessibility auditing)";

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

/**
 * Which Chromium build to launch.
 *
 * Vercel functions run on Amazon Linux, which does not carry the shared
 * libraries a stock Playwright Chromium links against — it exits 127 with
 * "error while loading shared libraries: libnspr4.so". Playwright's own
 * `install --with-deps` cannot help: it shells out to apt-get, which is not
 * there either. @sparticuz/chromium is a Lambda-targeted build that bundles
 * them, so serverless uses that and local development uses Playwright's.
 */
export function chromiumStrategy(
  env: Record<string, string | undefined> = process.env
): "sparticuz" | "playwright" {
  if (env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME) return "sparticuz";
  return "playwright";
}

export async function launchBrowser() {
  // Imported lazily on purpose. instrumentation.ts -> scheduler -> crawler
  // reaches this module at boot, and a top-level browser import made a
  // packaging fault crash every route, not just the scanning ones.
  const { chromium } = await import("playwright-core");

  if (chromiumStrategy() === "sparticuz") {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      executablePath: await sparticuz.executablePath(),
      args: [...sparticuz.args, "--disable-dev-shm-usage"],
      headless: true,
    });
  }

  const { chromium: local } = await import("playwright");
  return local.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
}

export async function createContext(
  browser: Awaited<ReturnType<typeof launchBrowser>>
) {
  return browser.newContext({
    userAgent: USER_AGENT,
    viewport: DEFAULT_VIEWPORT,
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,sv;q=0.8" },
  });
}

/**
 * Fixed pause between navigations so a scan does not hammer the target.
 * Politeness, not timing camouflage — hence fixed rather than randomised.
 */
export const CRAWL_DELAY_MS = 1000;

export function crawlDelay(ms: number = CRAWL_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
