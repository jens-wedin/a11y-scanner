import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./run-schedules/route";

function get(headers: Record<string, string> = {}) {
  return GET(
    new NextRequest("http://localhost/api/cron/run-schedules", { headers })
  );
}

describe("GET /api/cron/run-schedules — authorisation", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
    // Don't actually kick off scans in these tests.
    vi.doMock("@/lib/scheduler", () => ({ runDueSchedules: async () => [] }));
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
    vi.doUnmock("@/lib/scheduler");
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await get({ authorization: "Bearer wrong" });
    expect(res.status).toBe(401);
  });

  it("accepts a request carrying the configured secret", async () => {
    const res = await get({ authorization: "Bearer s3cret" });
    expect(res.status).toBe(200);
  });

  // Without this, deploying before CRON_SECRET is set would expose an
  // unauthenticated endpoint that starts scans.
  it("refuses to run at all when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await get({ authorization: "Bearer anything" });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/CRON_SECRET/);
  });

  it("does not leak the secret in a rejection body", async () => {
    const res = await get({ authorization: "Bearer wrong" });
    expect(JSON.stringify(await res.json())).not.toContain("s3cret");
  });
});
