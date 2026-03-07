import { chromium } from "playwright";
import type { CrawledUrl } from "./types";

export function isSameDomain(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // Remove trailing slash except for root path
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return url;
  }
}

async function runCrawl(
  startUrl: string,
  maxPages: number,
  maxDepth: number | undefined,
  headless: boolean
): Promise<CrawledUrl[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const result: CrawledUrl[] = [];
  const queue: Array<{ url: string; depth: number }> = [
    { url: normalizeUrl(startUrl), depth: 0 },
  ];

  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    while (queue.length > 0 && result.length < maxPages) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url)) continue;
      if (maxDepth !== undefined && depth > maxDepth) continue;

      visited.add(url);

      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        if (!response || !response.ok()) {
          // If the very first URL is blocked, surface a clear error
          if (result.length === 0 && visited.size === 1) {
            const status = response?.status() ?? 0;
            throw new Error(`BOT_PROTECTION:${status}`);
          }
          continue;
        }

        const title = await page.title();
        result.push({ url, title, depth });

        if (result.length < maxPages) {
          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a[href]"))
              .map((a) => (a as HTMLAnchorElement).href)
              .filter(Boolean)
          );

          for (const raw of links) {
            const normalized = normalizeUrl(raw);
            if (
              isSameDomain(normalized, origin) &&
              !visited.has(normalized) &&
              !queue.some((q) => q.url === normalized)
            ) {
              queue.push({ url: normalized, depth: depth + 1 });
            }
          }
        }
      } catch (err) {
        // Re-throw bot-protection errors so the caller can handle them
        if (err instanceof Error && err.message.startsWith("BOT_PROTECTION:")) {
          throw err;
        }
        // Skip individual unreachable pages silently
      }
    }
  } finally {
    await browser.close();
  }

  return result;
}

export async function crawl(
  startUrl: string,
  maxPages: number,
  maxDepth?: number
): Promise<{ urls: CrawledUrl[]; headless: boolean }> {
  try {
    const urls = await runCrawl(startUrl, maxPages, maxDepth, true);
    return { urls, headless: true };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("BOT_PROTECTION:")) {
      // Retry with a visible browser — bypasses most bot protection (Cloudflare etc.)
      const urls = await runCrawl(startUrl, maxPages, maxDepth, false);
      return { urls, headless: false };
    }
    throw err;
  }
}
