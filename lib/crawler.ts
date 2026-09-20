import { launchBrowser, createContext, crawlDelay } from "./browser";
import { assertScannableUrl, BlockedUrlError } from "./url-guard";
import type { CrawledUrl } from "./types";

/**
 * Turns a failed first navigation into something the operator can act on.
 *
 * The crawler used to surface its internal sentinel ("BLOCKED:403") straight
 * to the UI, which said nothing about what to do next.
 *
 * Note what this deliberately does not offer: a way around the block. The
 * scanner identifies itself honestly and does not evade bot protection — on a
 * site you do not own, the route through a 403 is permission, not
 * circumvention. See DEC-1 in docs/BACKLOG.md.
 */
export function describeBlock(status: number, url: string): string {
  const where = `Could not scan ${url}`;

  if (status === 403) {
    return (
      `${where} — the site refused the request (HTTP 403). This is normally a ` +
      `firewall or bot-protection service rather than a broken page. Ask the ` +
      `site owner for written permission and have them allowlist the scanner's ` +
      `user-agent, or point the scan at a staging environment you control.`
    );
  }

  if (status === 401) {
    return (
      `${where} — the site requires authentication (HTTP 401). The scanner has ` +
      `no credentials. Scan a publicly reachable environment, or one where the ` +
      `owner has granted access.`
    );
  }

  if (status === 429) {
    return (
      `${where} — the site is rate limiting us (HTTP 429, too many requests). ` +
      `Wait and try again, or scan fewer pages so the crawl is slower.`
    );
  }

  if (status === 404) {
    return `${where} — the page was not found (HTTP 404). Check the URL is correct.`;
  }

  if (status >= 500) {
    return (
      `${where} — the site returned a server error (HTTP ${status}). That is a ` +
      `fault on their side; try again later.`
    );
  }

  if (status === 0) {
    return (
      `${where} — the site did not respond. It may be unreachable, the request ` +
      `may have timed out, or the address may be wrong.`
    );
  }

  return `${where} — the site refused the request (HTTP ${status}).`;
}

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
  maxDepth: number | undefined
): Promise<CrawledUrl[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const result: CrawledUrl[] = [];
  const queue: Array<{ url: string; depth: number }> = [
    { url: normalizeUrl(startUrl), depth: 0 },
  ];

  const browser = await launchBrowser();
  const context = await createContext(browser);
  const page = await context.newPage();

  try {
    let isFirstPage = true;

    while (queue.length > 0 && result.length < maxPages) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url)) continue;
      if (maxDepth !== undefined && depth > maxDepth) continue;

      visited.add(url);

      // Every navigation target is re-checked, not just the seed: a discovered
      // link or a redirect can point at an internal address.
      try {
        await assertScannableUrl(url);
      } catch (err) {
        if (err instanceof BlockedUrlError) continue;
        throw err;
      }

      // Politeness pause so a scan does not hammer the target.
      if (!isFirstPage) {
        await crawlDelay();
      }

      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: isFirstPage ? 30000 : 15000,
        });

        isFirstPage = false;

        // Re-check the response after potential challenge resolution.
        // If the page redirected during the challenge, get the new status.
        const finalStatus = response?.status() ?? 0;
        const finalUrl = page.url();

        // A permitted host can redirect to an internal one — if that happened,
        // abandon this page without reading its title, links or content.
        if (finalUrl !== url) {
          try {
            await assertScannableUrl(finalUrl);
          } catch (err) {
            if (err instanceof BlockedUrlError) continue;
            throw err;
          }
        }

        if (!(response?.ok() ?? false)) {
          if (result.length === 0 && visited.size === 1) {
            throw new Error(`BLOCKED:${finalStatus}`);
          }
          continue;
        }

        const title = await page.title();
        const pageUrl = normalizeUrl(finalUrl);
        result.push({ url: pageUrl, title, depth });

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
        if (err instanceof Error && err.message.startsWith("BLOCKED:")) {
          throw err;
        }
        // If the seed page itself fails there is nothing to crawl.
        if (result.length === 0 && visited.size === 1) {
          throw new Error("BLOCKED:0");
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
): Promise<CrawledUrl[]> {
  // Validated before anything launches, so a blocked URL surfaces as itself.
  await assertScannableUrl(startUrl);

  let urls: CrawledUrl[];
  try {
    urls = await runCrawl(startUrl, maxPages, maxDepth);
  } catch (err) {
    // Translate the internal sentinel rather than letting it reach the UI.
    if (err instanceof Error && err.message.startsWith("BLOCKED:")) {
      const status = Number(err.message.slice("BLOCKED:".length)) || 0;
      throw new Error(describeBlock(status, startUrl));
    }
    throw err;
  }

  if (urls.length === 0) {
    throw new Error(
      "No pages could be discovered. Check the URL is reachable, and that the " +
        "site permits automated accessibility scanning — see the allowlist " +
        "guidance in the README."
    );
  }

  return urls;
}
