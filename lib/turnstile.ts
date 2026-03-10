import type { Page, Frame } from "playwright-core";

/**
 * Detect if a Cloudflare Turnstile widget is present on the page.
 */
export async function detectTurnstile(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Turnstile iframe
    const iframe = document.querySelector(
      'iframe[src*="challenges.cloudflare.com"]'
    );
    if (iframe) return true;

    // Turnstile container div
    const container =
      document.querySelector(".cf-turnstile") ||
      document.querySelector("[data-sitekey]");
    if (container) return true;

    return false;
  }).catch(() => false);
}

/**
 * Find the Turnstile iframe element inside the page.
 */
async function findTurnstileFrame(page: Page): Promise<Frame | null> {
  // Wait briefly for the iframe to appear (Turnstile injects it dynamically)
  try {
    await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', {
      timeout: 5000,
    });
  } catch {
    return null;
  }

  for (const frame of page.frames()) {
    const url = frame.url();
    if (url.includes("challenges.cloudflare.com")) {
      return frame;
    }
  }

  return null;
}

/**
 * Attempt to solve a Cloudflare Turnstile challenge by clicking the checkbox.
 *
 * In "managed" mode (most common), Turnstile shows a checkbox that auto-passes
 * if the browser fingerprint looks legitimate. Our stealth plugin handles that.
 *
 * Returns true if the challenge was detected and resolved, false otherwise.
 */
export async function handleTurnstile(page: Page): Promise<boolean> {
  const hasTurnstile = await detectTurnstile(page);
  if (!hasTurnstile) return false;

  const frame = await findTurnstileFrame(page);
  if (!frame) return false;

  // Click the Turnstile checkbox. The checkbox input is inside the iframe
  // at a consistent location. Try multiple selectors.
  try {
    // Try clicking the checkbox input directly
    const checkbox = await frame.$('input[type="checkbox"]');
    if (checkbox) {
      await checkbox.click();
    } else {
      // Fallback: click the center of the iframe (checkbox is typically centered)
      const iframeElement = await page.$(
        'iframe[src*="challenges.cloudflare.com"]'
      );
      if (iframeElement) {
        const box = await iframeElement.boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + box.width / 2,
            box.y + box.height / 2
          );
        }
      }
    }
  } catch {
    // Click failed — challenge may be non-interactive
    return false;
  }

  // Wait for the challenge to resolve
  return waitForTurnstileResolution(page);
}

/**
 * Poll for up to 15s to see if the Turnstile challenge has resolved.
 * Checks for: iframe disappearing, cf_clearance cookie, or page navigation.
 */
async function waitForTurnstileResolution(page: Page): Promise<boolean> {
  const maxWait = 15000;
  const interval = 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    // Check if the Turnstile iframe is gone (challenge passed, page reloading)
    const stillPresent = await detectTurnstile(page);
    if (!stillPresent) return true;

    // Check for cf_clearance cookie (set after passing Cloudflare)
    const cookies = await page.context().cookies();
    const hasClearance = cookies.some((c) => c.name === "cf_clearance");
    if (hasClearance) return true;

    // Check if the checkbox is now checked (success state)
    const isChecked = await page
      .evaluate(() => {
        const iframe = document.querySelector(
          'iframe[src*="challenges.cloudflare.com"]'
        );
        if (!iframe) return false;
        // Turnstile adds a success class or data attribute when solved
        const parent = iframe.parentElement;
        return parent?.getAttribute("data-status") === "solved";
      })
      .catch(() => false);
    if (isChecked) return true;

    await new Promise((r) => setTimeout(r, interval));
  }

  return false;
}
