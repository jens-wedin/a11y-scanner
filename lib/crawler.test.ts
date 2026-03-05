import { describe, it, expect } from "vitest";
import { isSameDomain, normalizeUrl } from "./crawler";

describe("crawler utils", () => {
  it("isSameDomain: same origin returns true", () => {
    expect(isSameDomain("https://example.com/page", "https://example.com")).toBe(true);
  });

  it("isSameDomain: different origin returns false", () => {
    expect(isSameDomain("https://other.com/page", "https://example.com")).toBe(false);
  });

  it("normalizeUrl: strips hash fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page"
    );
  });

  it("normalizeUrl: strips trailing slash from non-root", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe(
      "https://example.com/page"
    );
  });

  it("normalizeUrl: keeps root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
});
