import { describe, it, expect } from "vitest";
import { chromiumStrategy, USER_AGENT } from "./browser";

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
