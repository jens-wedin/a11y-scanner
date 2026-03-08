import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  loadSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedule,
} from "./schedules";

describe("schedules persistence", () => {
  const originalFile = path.join(process.cwd(), "schedules.json");

  beforeEach(() => {
    if (fs.existsSync(originalFile)) fs.unlinkSync(originalFile);
  });

  afterEach(() => {
    if (fs.existsSync(originalFile)) fs.unlinkSync(originalFile);
  });

  it("loadSchedules returns [] when file missing", () => {
    expect(loadSchedules()).toEqual([]);
  });

  it("createSchedule persists and returns schedule with id", () => {
    const s = createSchedule({
      name: "Test",
      cronExpression: "0 9 1 * *",
      config: { targetUrl: "https://example.com", maxPages: 10 },
      enabled: true,
      notification: {},
    });
    expect(s.id).toBeTruthy();
    expect(loadSchedules()).toHaveLength(1);
  });

  it("updateSchedule modifies an existing schedule", () => {
    const s = createSchedule({
      name: "Test",
      cronExpression: "0 9 1 * *",
      config: { targetUrl: "https://example.com", maxPages: 10 },
      enabled: true,
      notification: {},
    });
    const updated = updateSchedule(s.id, { enabled: false });
    expect(updated?.enabled).toBe(false);
    expect(getSchedule(s.id)?.enabled).toBe(false);
  });

  it("deleteSchedule removes schedule", () => {
    const s = createSchedule({
      name: "Test",
      cronExpression: "0 9 1 * *",
      config: { targetUrl: "https://example.com", maxPages: 10 },
      enabled: true,
      notification: {},
    });
    expect(deleteSchedule(s.id)).toBe(true);
    expect(loadSchedules()).toHaveLength(0);
  });
});
