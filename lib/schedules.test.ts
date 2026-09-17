import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedule,
} from "./schedules";
import { getSql, ensureSchema } from "./db";

const base = {
  name: "Test",
  cronExpression: "0 9 1 * *",
  config: { targetUrl: "https://example.com", maxPages: 10 as const },
  enabled: true,
  notification: {},
};

describe("schedules persistence (Postgres)", () => {
  beforeEach(async () => {
    await ensureSchema();
    await getSql()`delete from schedules`;
  });

  it("loadSchedules returns [] when none exist", async () => {
    expect(await loadSchedules()).toEqual([]);
  });

  it("createSchedule persists and returns a schedule with an id", async () => {
    const s = await createSchedule(base);
    expect(s.id).toBeTruthy();
    expect(await loadSchedules()).toHaveLength(1);
  });

  it("getSchedule returns the stored record", async () => {
    const s = await createSchedule(base);
    const found = await getSchedule(s.id);
    expect(found?.name).toBe("Test");
    expect(found?.config.targetUrl).toBe("https://example.com");
  });

  it("getSchedule returns undefined for an unknown id", async () => {
    expect(
      await getSchedule("22222222-2222-4222-8222-222222222222")
    ).toBeUndefined();
  });

  it("updateSchedule modifies an existing schedule", async () => {
    const s = await createSchedule(base);
    const updated = await updateSchedule(s.id, { enabled: false });
    expect(updated?.enabled).toBe(false);
    expect((await getSchedule(s.id))?.enabled).toBe(false);
  });

  it("updateSchedule returns null for an unknown id", async () => {
    expect(
      await updateSchedule("33333333-3333-4333-8333-333333333333", { enabled: false })
    ).toBeNull();
  });

  it("updateSchedule can clear a field", async () => {
    const s = await createSchedule(base);
    await updateSchedule(s.id, { runningAt: new Date().toISOString() });
    expect((await getSchedule(s.id))?.runningAt).toBeTruthy();
    await updateSchedule(s.id, { runningAt: undefined });
    expect((await getSchedule(s.id))?.runningAt).toBeUndefined();
  });

  it("deleteSchedule removes the schedule", async () => {
    const s = await createSchedule(base);
    expect(await deleteSchedule(s.id)).toBe(true);
    expect(await loadSchedules()).toHaveLength(0);
  });

  it("deleteSchedule returns false for an unknown id", async () => {
    expect(
      await deleteSchedule("44444444-4444-4444-8444-444444444444")
    ).toBe(false);
  });

  it("does not write anything to the local filesystem", async () => {
    const fs = await import("fs");
    const path = await import("path");
    await createSchedule(base);
    expect(fs.existsSync(path.join(process.cwd(), "schedules.json"))).toBe(false);
  });
});
