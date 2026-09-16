import { chromium } from "playwright";

/**
 * Identifies the scanner honestly. Site owners who want to allow it can match
 * on this string; site owners who want to block it can, too. That is the point.
 */
export const USER_AGENT =
  "A11yScanner/0.7 (+https://studiomanfred.com/a11y-scanner; accessibility auditing)";

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export async function launchBrowser() {
  return chromium.launch({
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
