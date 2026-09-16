import { describe, it, expect } from "vitest";
import { checkEnvironment } from "./env-check";

describe("checkEnvironment", () => {
  it("reports a missing ANTHROPIC_API_KEY", () => {
    const problems = checkEnvironment({});
    expect(problems.join("\n")).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("names the misspelling when only the typo'd variable is set", () => {
    const problems = checkEnvironment({ ANTROPHIC_API_KEY: "sk-ant-xxx" });
    const text = problems.join("\n");
    expect(text).toMatch(/ANTROPHIC_API_KEY/);
    expect(text).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("is quiet when the key is set correctly", () => {
    expect(checkEnvironment({ ANTHROPIC_API_KEY: "sk-ant-xxx" })).toEqual([]);
  });

  it("warns when RESEND_API_KEY is set without RESEND_FROM", () => {
    const problems = checkEnvironment({
      ANTHROPIC_API_KEY: "sk-ant-xxx",
      RESEND_API_KEY: "re_xxx",
    });
    expect(problems.join("\n")).toMatch(/RESEND_FROM/);
  });

  it("is quiet when email is fully configured", () => {
    expect(
      checkEnvironment({
        ANTHROPIC_API_KEY: "sk-ant-xxx",
        RESEND_API_KEY: "re_xxx",
        RESEND_FROM: "reports@example.com",
      })
    ).toEqual([]);
  });

  it("does not leak secret values into the messages", () => {
    const problems = checkEnvironment({ ANTROPHIC_API_KEY: "sk-ant-SECRET123" });
    expect(problems.join("\n")).not.toContain("SECRET123");
  });
});
