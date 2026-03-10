import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Use the most aggressive stealth mode for rebrowser-patches.
// "alwaysIsolated" runs all scripts in isolated contexts to prevent
// detection of the Runtime.Enable CDP command leak.
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = "alwaysIsolated";

// Register stealth plugin once — adds ~10 evasion techniques:
// WebGL vendor, Chrome runtime, permissions, navigator.plugins, etc.
chromium.use(StealthPlugin());

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export async function launchBrowser(headless: boolean) {
  return chromium.launch({
    headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });
}

export async function createStealthContext(
  browser: Awaited<ReturnType<typeof launchBrowser>>
) {
  const context = await browser.newContext({
    userAgent: CHROME_USER_AGENT,
    viewport: DEFAULT_VIEWPORT,
    screen: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "Europe/Stockholm",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,sv;q=0.8" },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return context;
}

/** Random delay between min and max milliseconds */
export function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
