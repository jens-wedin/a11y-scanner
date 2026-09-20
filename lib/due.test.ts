import { describe, it, expect } from "vitest";
import { isDue, isValidCron } from "./due";
import type { Schedule } from "./types";

const at = (iso: string) => new Date(iso);

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    name: "Nightly",
    cronExpression: "0 2 * * *", // 02:00 every day
    config: { targetUrl: "https://example.com", maxPages: 10 },
    enabled: true,
    notification: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isDue", () => {
  it("is due when the schedule has never run and an occurrence has passed", () => {
    expect(isDue(schedule(), at("2026-03-10T02:05:00Z"))).toBe(true);
  });

  it("is not due when the last run is after the most recent occurrence", () => {
    expect(
      isDue(
        schedule({ lastRunAt: "2026-03-10T02:01:00Z" }),
        at("2026-03-10T02:05:00Z")
      )
    ).toBe(false);
  });

  it("is due again once the next occurrence passes", () => {
    expect(
      isDue(
        schedule({ lastRunAt: "2026-03-10T02:01:00Z" }),
        at("2026-03-11T02:05:00Z")
      )
    ).toBe(true);
  });

  it("is never due when disabled", () => {
    expect(isDue(schedule({ enabled: false }), at("2026-03-10T02:05:00Z"))).toBe(
      false
    );
  });

  it("is not due while a run is already in flight", () => {
    expect(
      isDue(
        schedule({ runningAt: "2026-03-10T02:00:30Z" }),
        at("2026-03-10T02:05:00Z")
      )
    ).toBe(false);
  });

  it("treats a stale runningAt as abandoned so a crash does not wedge it forever", () => {
    expect(
      isDue(
        schedule({ runningAt: "2026-03-10T02:00:00Z" }),
        at("2026-03-10T05:00:00Z") // three hours later
      )
    ).toBe(true);
  });

  it("is false rather than throwing for an invalid cron expression", () => {
    expect(
      isDue(schedule({ cronExpression: "not a cron" }), at("2026-03-10T02:05:00Z"))
    ).toBe(false);
  });

  it("does not fire twice within one occurrence window", () => {
    const s = schedule({ lastRunAt: "2026-03-10T02:00:10Z" });
    expect(isDue(s, at("2026-03-10T02:04:00Z"))).toBe(false);
    expect(isDue(s, at("2026-03-10T23:59:00Z"))).toBe(false);
  });
});

describe("isValidCron", () => {
  it("accepts a standard five-field expression", () => {
    expect(isValidCron("0 2 * * *")).toBe(true);
    expect(isValidCron("*/5 * * * *")).toBe(true);
    expect(isValidCron("0 3 * * 1")).toBe(true);
  });

  it("rejects nonsense", () => {
    expect(isValidCron("not a cron")).toBe(false);
    expect(isValidCron("")).toBe(false);
    expect(isValidCron("99 99 99 99 99")).toBe(false);
  });
});
