import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Schedule } from "./types";
import { buildEmailHtml, sendEmail } from "./scheduler";

// Shared test schedule
const testSchedule: Schedule = {
  id: "sched-1",
  name: "Nightly scan",
  cronExpression: "0 2 * * *",
  config: { targetUrl: "https://example.com", maxPages: 50 },
  enabled: true,
  createdAt: "2026-01-01T00:00:00Z",
  notification: { email: "team@example.com" },
};

const testSummary = { totalIssues: 12, criticalCount: 2, seriousCount: 5 };

describe("buildEmailHtml", () => {
  it("includes schedule name and target URL", () => {
    const html = buildEmailHtml(testSchedule, "scan-123", testSummary);
    expect(html).toContain("Nightly scan");
    expect(html).toContain("https://example.com");
  });

  it("includes issue counts", () => {
    const html = buildEmailHtml(testSchedule, "scan-123", testSummary);
    expect(html).toContain("12");
    expect(html).toContain("2");
    expect(html).toContain("5");
  });

  it("links to /report/ not /scan/", () => {
    const html = buildEmailHtml(testSchedule, "scan-123", testSummary);
    expect(html).toContain("/report/scan-123");
    expect(html).not.toContain("/scan/scan-123");
  });

  it("uses BASE_URL env var when set", () => {
    process.env.BASE_URL = "https://a11y.example.com";
    const html = buildEmailHtml(testSchedule, "scan-123", testSummary);
    expect(html).toContain("https://a11y.example.com/report/scan-123");
    delete process.env.BASE_URL;
  });

  it("falls back to localhost when BASE_URL is not set", () => {
    delete process.env.BASE_URL;
    const html = buildEmailHtml(testSchedule, "scan-123", testSummary);
    expect(html).toContain("http://localhost:3000/report/scan-123");
  });
});

describe("sendEmail", () => {
  const mockSend = vi.fn().mockResolvedValue({ id: "email-1" });

  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();

    // Mock resend module
    vi.mock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({
        emails: { send: mockSend },
      })),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("skips when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM = "noreply@example.com";

    await sendEmail(testSchedule, "scan-1", testSummary);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when RESEND_FROM is missing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM;

    await sendEmail(testSchedule, "scan-1", testSummary);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when schedule has no notification email", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "noreply@example.com";

    const noEmailSchedule = {
      ...testSchedule,
      notification: {},
    };
    await sendEmail(noEmailSchedule, "scan-1", testSummary);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
