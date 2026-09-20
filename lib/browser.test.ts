import { describe, it, expect } from "vitest";
import { chromiumStrategy, scanConcurrency, USER_AGENT } from "./browser";

describe("chromiumStrategy", () => {
  // Vercel functions run on Amazon Linux, which lacks the shared libraries a
  // stock Playwright Chromium links against:
  //   error while loading shared libraries: libnspr4.so
  // @sparticuz/chromium ships a build with those bundled.
  it("uses the Lambda-targeted build on Vercel", () => {
    expect(chromiumStrategy({ VERCEL: "1" })).toBe("sparticuz");
  });

  it("uses the Lambda-targeted build on AWS Lambda generally", () => {
    expect(chromiumStrategy({ AWS_LAMBDA_FUNCTION_NAME: "fn" })).toBe("sparticuz");
  });

  it("uses Playwright's own browser locally", () => {
    expect(chromiumStrategy({})).toBe("playwright");
  });

  it("treats an empty VERCEL value as not-Vercel", () => {
    expect(chromiumStrategy({ VERCEL: "" })).toBe("playwright");
  });
});

describe("USER_AGENT", () => {
  it("identifies the scanner and gives a contact URL", () => {
    expect(USER_AGENT).toMatch(/A11yScanner/);
    expect(USER_AGENT).toMatch(/https?:\/\//);
  });

  it("does not impersonate a consumer browser", () => {
    expect(USER_AGENT).not.toMatch(/Mozilla|AppleWebKit|Safari/);
  });
});

describe("scanConcurrency", () => {
  // @sparticuz/chromium launches with --single-process --no-zygote inside a
  // memory-capped function. Driving three pages at once through that killed the
  // browser mid-scan: "Target page, context or browser has been closed".
  it("serialises pages on serverless", () => {
    expect(scanConcurrency({ VERCEL: "1" })).toBe(1);
    expect(scanConcurrency({ AWS_LAMBDA_FUNCTION_NAME: "fn" })).toBe(1);
  });

  it("allows parallelism locally, where Chromium is multi-process", () => {
    expect(scanConcurrency({})).toBeGreaterThan(1);
  });

  it("never returns zero or negative", () => {
    for (const env of [{}, { VERCEL: "1" }]) {
      expect(scanConcurrency(env)).toBeGreaterThanOrEqual(1);
    }
  });
});
