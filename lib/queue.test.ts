import { describe, it, expect, beforeEach } from "vitest";
import {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  clearAllJobs,
} from "./queue";
import type { ScanJob } from "./types";

const makeJob = (id: string): ScanJob => ({
  id,
  status: "pending",
  config: { targetUrl: "https://example.com", maxPages: 10 },
  startedAt: new Date().toISOString(),
  progress: { scannedCount: 0, totalCount: 0 },
});

describe("queue", () => {
  beforeEach(() => clearAllJobs());

  it("creates and retrieves a job", () => {
    const job = makeJob("abc");
    createJob(job);
    expect(getJob("abc")).toEqual(job);
  });

  it("returns undefined for unknown job", () => {
    expect(getJob("nope")).toBeUndefined();
  });

  it("updates job fields", () => {
    createJob(makeJob("abc"));
    updateJob("abc", { status: "scanning" });
    expect(getJob("abc")?.status).toBe("scanning");
  });

  it("merges progress fields correctly", () => {
    createJob(makeJob("abc"));
    updateJob("abc", { progress: { scannedCount: 5, totalCount: 10 } });
    expect(getJob("abc")?.progress.scannedCount).toBe(5);
  });

  it("deletes a job", () => {
    createJob(makeJob("abc"));
    deleteJob("abc");
    expect(getJob("abc")).toBeUndefined();
  });
});
