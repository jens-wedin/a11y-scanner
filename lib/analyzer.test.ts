import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawPageResult, A11yIssue } from "./types";

const samplePageResult: RawPageResult = {
  url: "https://example.com/",
  violations: [
    {
      id: "image-alt",
      impact: "critical",
      description: "Images must have alternate text",
      help: "Image elements must have an alt attribute",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
      nodes: [
        {
          html: '<img src="logo.png">',
          target: ["img"],
          failureSummary: "Fix: add alt attribute",
        },
      ],
    },
  ],
  scannedAt: "2026-03-04T10:00:00Z",
};

const mockIssue: A11yIssue = {
  id: "image-alt",
  title: "Images missing alt text",
  description: "Images do not have descriptive alternative text.",
  wcagCriterion: "1.1.1 Non-text Content",
  wcagLevel: "A",
  wcagDocUrl:
    "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
  eaaRisk: "high",
  businessImpact: "Blind users cannot understand image content",
  fixComplexity: "low",
  affectedPages: ["https://example.com/"],
  occurrenceCount: 1,
  severity: "critical",
  codeExample: '<img src="logo.png">',
  recommendedFix: '<img src="logo.png" alt="Company logo">',
};

// Shared mock function — must be named with 'mock' prefix for vi.mock hoisting
const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockMessagesCreate };
    },
  };
});

describe("analyzeViolations", () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset();
  });

  it("returns parsed issues on success", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify([mockIssue]) }],
    });

    const { analyzeViolations } = await import("./analyzer");
    const result = await analyzeViolations(
      [samplePageResult],
      "https://example.com"
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("image-alt");
    expect(result[0].wcagLevel).toBe("A");
  });

  it("returns fallback issues when Claude returns invalid JSON", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not valid json [[[" }],
    });

    const { analyzeViolations } = await import("./analyzer");
    const result = await analyzeViolations(
      [samplePageResult],
      "https://example.com"
    );

    // Fallback returns at least one issue derived from raw violations
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe("image-alt");
  });

  it("returns fallback issues when Claude API throws", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("API error"));

    const { analyzeViolations } = await import("./analyzer");
    const result = await analyzeViolations(
      [samplePageResult],
      "https://example.com"
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBeDefined();
  });
});
