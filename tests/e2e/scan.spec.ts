import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders scan configuration form", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Accessibility Scanner" })
    ).toBeVisible();
    await expect(page.getByLabel("Website URL")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Discover URLs/i })
    ).toBeVisible();
  });

  test("shows error for invalid URL format", async ({ page }) => {
    await page.goto("/");
    // Fill with a non-URL string — React state updates but native type=url won't validate
    // We use the input's label to find it and set value via evaluate to bypass browser validation
    const input = page.getByLabel("Website URL");
    await input.fill("not-a-url");
    // Force the React state to see the value by dispatching an input event
    await page.evaluate(() => {
      const el = document.getElementById("targetUrl") as HTMLInputElement;
      if (el) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(el, "not-a-url");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.getByRole("button", { name: /Discover URLs/i }).click();
    // Our JS validation runs — should show error
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    // The form should not have navigated away
    await expect(page).toHaveURL("/");
  });

  test("max pages radio buttons are all present", async ({ page }) => {
    await page.goto("/");
    for (const n of [10, 50, 100, 200]) {
      await expect(
        page.getByRole("radio", { name: String(n), exact: true })
      ).toBeVisible();
    }
    // 50 should be pre-selected
    await expect(
      page.getByRole("radio", { name: "50", exact: true })
    ).toBeChecked();
  });
});

test.describe("Report page", () => {
  test("shows graceful error for non-existent report", async ({ page }) => {
    await page.goto("/report/non-existent-scan-id-12345");
    // Use first() to target our error alert, not Next.js route announcer
    const errorAlert = page
      .getByRole("alert")
      .filter({ hasText: "not available" });
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("not available");
  });

  test("has a link back to home from error state", async ({ page }) => {
    await page.goto("/report/non-existent-scan-id-12345");
    await expect(
      page.getByRole("link", { name: /new scan/i })
    ).toBeVisible();
  });
});

test.describe("Crawl preview page", () => {
  test("shows loading message when no session data exists", async ({ page }) => {
    // Navigate directly without session storage data
    await page.goto("/crawl/fake-scan-id-99999");
    await expect(
      page.getByText(/Loading discovered pages/i)
    ).toBeVisible();
  });
});
