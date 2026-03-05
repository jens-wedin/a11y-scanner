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

export async function crawl(
  startUrl: string,
  maxPages: number,
  maxDepth?: number
): Promise<CrawledUrl[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const result: CrawledUrl[] = [];
  const queue: Array<{ url: string; depth: number }> = [
    { url: normalizeUrl(startUrl), depth: 0 },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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
        if (!response || !response.ok()) continue;

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
      } catch {
        // Skip unreachable pages silently
      }
    }
  } finally {
    await browser.close();
  }

  return result;
}
