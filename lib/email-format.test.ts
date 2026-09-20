import { describe, it, expect } from "vitest";
import { parseEmailFormat } from "./email-format";

describe("parseEmailFormat", () => {
  it("accepts embed as its own mode", () => {
    expect(parseEmailFormat("embed")).toEqual({ mode: "embed" });
  });

  it("accepts a single attachment", () => {
    expect(parseEmailFormat("pdf")).toEqual({ mode: "attach", attachments: ["pdf"] });
    expect(parseEmailFormat("csv")).toEqual({ mode: "attach", attachments: ["csv"] });
  });

  // The dialog has always sent "pdf+json"; existing callers must keep working.
  it("still accepts the legacy combined string", () => {
    expect(parseEmailFormat("pdf+json")).toEqual({
      mode: "attach",
      attachments: ["pdf", "json"],
    });
  });

  it("accepts any combination rather than a fixed list", () => {
    expect(parseEmailFormat("pdf+json+csv")).toEqual({
      mode: "attach",
      attachments: ["pdf", "json", "csv"],
    });
    expect(parseEmailFormat("json+csv")).toEqual({
      mode: "attach",
      attachments: ["json", "csv"],
    });
  });

  it("deduplicates repeats", () => {
    expect(parseEmailFormat("pdf+pdf")).toEqual({ mode: "attach", attachments: ["pdf"] });
  });

  it("ignores surrounding whitespace", () => {
    expect(parseEmailFormat(" pdf + csv ")).toEqual({
      mode: "attach",
      attachments: ["pdf", "csv"],
    });
  });

  it("rejects an unknown attachment type", () => {
    expect(parseEmailFormat("pdf+exe")).toHaveProperty("error");
    expect(parseEmailFormat("docx")).toHaveProperty("error");
  });

  it("rejects embed combined with attachments, which is not a thing", () => {
    expect(parseEmailFormat("embed+pdf")).toHaveProperty("error");
  });

  it("rejects empty or non-string input", () => {
    for (const bad of ["", "   ", "+", undefined, null, 7, {}]) {
      expect(parseEmailFormat(bad)).toHaveProperty("error");
    }
  });

  it("names the accepted values in its error so the caller can act", () => {
    const result = parseEmailFormat("docx");
    expect("error" in result && result.error).toMatch(/pdf/);
    expect("error" in result && result.error).toMatch(/csv/);
  });
});
