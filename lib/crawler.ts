import { launchBrowser, createStealthContext, randomDelay } from "./browser";
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

  const browser = await launchBrowser(headless);
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    let isFirstPage = true;

    while (queue.length > 0 && result.length < maxPages) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url)) continue;
      if (maxDepth !== undefined && depth > maxDepth) continue;

      visited.add(url);

      // Add a random delay between navigations to avoid bot detection
      if (!isFirstPage) {
        await randomDelay(1000, 3000);
      }

      try {
        const response = await page.goto(url, {
          // Use networkidle for the first page so Cloudflare challenge
          // pages can complete their redirect. Faster domcontentloaded
          // for subsequent pages.
          waitUntil: isFirstPage ? "networkidle" : "domcontentloaded",
          timeout: isFirstPage ? 30000 : 15000,
        });

        isFirstPage = false;

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
        // If the very first page fails for any reason (timeout, network error, etc.),
        // treat it like bot protection to trigger the headless=false retry
        if (result.length === 0 && visited.size === 1) {
          throw new Error("BOT_PROTECTION:0");
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
      if (urls.length === 0) {
        throw new Error(
          "No pages could be discovered. The site may be behind a paywall, " +
            "using Cloudflare protection, or blocking automated access."
        );
      }
      return { urls, headless: false };
    }
    throw err;
  }
}
