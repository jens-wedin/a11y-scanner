import { describe, it, expect, beforeEach } from "vitest";
import {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  clearAllJobs,
  addController,
  removeController,
  sendEvent,
} from "./queue";
import { ensureSchema } from "./db";
import type { ScanJob } from "./types";

const ID = "66666666-6666-4666-8666-666666666666";

const makeJob = (id: string): ScanJob => ({
  id,
  status: "pending",
  config: { targetUrl: "https://example.com", maxPages: 10 },
  startedAt: new Date().toISOString(),
  progress: { scannedCount: 0, totalCount: 0 },
});

describe("queue (Postgres-backed job state)", () => {
  beforeEach(async () => {
    await ensureSchema();
    await clearAllJobs();
  });

  it("createJob then getJob round-trips", async () => {
    await createJob(makeJob(ID));
    const job = await getJob(ID);
    expect(job?.id).toBe(ID);
    expect(job?.status).toBe("pending");
  });

  it("getJob returns undefined for an unknown id", async () => {
    expect(await getJob("77777777-7777-4777-8777-777777777777")).toBeUndefined();
  });

  it("updateJob merges top-level fields", async () => {
    await createJob(makeJob(ID));
    await updateJob(ID, { status: "scanning" });
    expect((await getJob(ID))?.status).toBe("scanning");
  });

  it("updateJob merges progress rather than replacing it", async () => {
    await createJob(makeJob(ID));
    await updateJob(ID, { progress: { totalCount: 5 } as never });
    const job = await getJob(ID);
    expect(job?.progress.totalCount).toBe(5);
    expect(job?.progress.scannedCount).toBe(0); // preserved
  });

  it("updateJob is a no-op for an unknown id", async () => {
    await expect(
      updateJob("88888888-8888-4888-8888-888888888888", { status: "done" })
    ).resolves.not.toThrow();
  });

  it("deleteJob removes the job", async () => {
    await createJob(makeJob(ID));
    await deleteJob(ID);
    expect(await getJob(ID)).toBeUndefined();
  });

  // Job state must survive a different invocation reading it back — that is the
  // whole reason it moved out of a module-scope Map.
  it("job state is visible to a caller that never saw the in-memory write", async () => {
    await createJob(makeJob(ID));
    const { getSql } = await import("./db");
    const rows = await getSql()`select data from scan_jobs where id = ${ID}`;
    expect((rows[0].data as ScanJob).config.targetUrl).toBe("https://example.com");
  });
});

describe("queue SSE controllers (stay in-process)", () => {
  it("sendEvent to an unknown id does not throw", () => {
    expect(() => sendEvent("nobody-listening", { type: "analysis-start" })).not.toThrow();
  });

  it("sendEvent enqueues to a registered controller", () => {
    const chunks: Uint8Array[] = [];
    addController(ID, {
      enqueue: (c: Uint8Array) => chunks.push(c),
    } as unknown as ReadableStreamDefaultController<Uint8Array>);

    sendEvent(ID, { type: "analysis-start" });

    expect(chunks).toHaveLength(1);
    expect(new TextDecoder().decode(chunks[0])).toContain("analysis-start");
    removeController(ID);
  });
});
