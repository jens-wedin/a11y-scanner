import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { PUT } from "./[id]/route";
import { createSchedule, getSchedule } from "@/lib/schedules";
import type { Schedule } from "@/lib/types";

const schedulesFile = path.join(process.cwd(), "schedules.json");

function put(id: string, body: unknown) {
  const request = new NextRequest(`http://localhost/api/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return PUT(request, { params: Promise.resolve({ id }) });
}

// enabled:false keeps registerSchedule from arming a real cron timer in-process.
function seed(): Schedule {
  return createSchedule({
    name: "Nightly scan",
    cronExpression: "0 2 * * *",
    config: { targetUrl: "https://example.com", maxPages: 10 },
    enabled: false,
    notification: {},
  });
}

describe("PUT /api/schedules/[id] — validation (SEC-4)", () => {
  beforeEach(() => {
    if (fs.existsSync(schedulesFile)) fs.unlinkSync(schedulesFile);
  });
  afterEach(() => {
    if (fs.existsSync(schedulesFile)) fs.unlinkSync(schedulesFile);
  });

  it("rejects an update that repoints targetUrl at an internal address", async () => {
    const s = seed();
    const res = await put(s.id, {
      config: { targetUrl: "http://169.254.169.254/latest/meta-data/", maxPages: 10 },
    });

    expect(res.status).toBe(400);
    expect(getSchedule(s.id)?.config.targetUrl).toBe("https://example.com");
  });

  it("rejects an update that repoints targetUrl at file://", async () => {
    const s = seed();
    const res = await put(s.id, {
      config: { targetUrl: "file:///etc/passwd", maxPages: 10 },
    });

    expect(res.status).toBe(400);
    expect(getSchedule(s.id)?.config.targetUrl).toBe("https://example.com");
  });

  it("rejects an invalid cron expression", async () => {
    const s = seed();
    const res = await put(s.id, { cronExpression: "not a cron" });

    expect(res.status).toBe(400);
    expect(getSchedule(s.id)?.cronExpression).toBe("0 2 * * *");
  });

  it("ignores attempts to overwrite server-owned fields", async () => {
    const s = seed();
    const res = await put(s.id, {
      name: "Renamed",
      id: "attacker-chosen-id",
      createdAt: "1970-01-01T00:00:00.000Z",
      lastScanId: "someone-elses-scan",
    });

    expect(res.status).toBe(200);
    const after = getSchedule(s.id);
    expect(after?.name).toBe("Renamed");
    expect(after?.id).toBe(s.id);
    expect(after?.createdAt).toBe(s.createdAt);
    expect(after?.lastScanId).toBeUndefined();
  });

  it("applies a legitimate update", async () => {
    const s = seed();
    const res = await put(s.id, {
      name: "Weekly scan",
      cronExpression: "0 3 * * 1",
      config: { targetUrl: "https://example.org", maxPages: 50 },
    });

    expect(res.status).toBe(200);
    const after = getSchedule(s.id);
    expect(after?.name).toBe("Weekly scan");
    expect(after?.cronExpression).toBe("0 3 * * 1");
    expect(after?.config.targetUrl).toBe("https://example.org");
  });

  it("returns 404 for an unknown schedule", async () => {
    const res = await put("no-such-id", { name: "x" });
    expect(res.status).toBe(404);
  });
});
