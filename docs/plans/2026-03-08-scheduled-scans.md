# Scheduled Scans Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recurring accessibility scans (daily/weekly/monthly/custom cron) with Resend email notifications and an in-app schedule management UI.

**Architecture:** Schedules stored in `schedules.json` on disk. `node-cron` registers jobs inside the Next.js server process, initialized via `instrumentation.ts` on server start. When fired, uses the existing `crawl()` → `scanPages()` → `analyzeViolations()` → `saveScanReport()` pipeline. Email sent via Resend API.

**Tech Stack:** node-cron, resend, Next.js 15 App Router, TypeScript, Tailwind CSS 4, Vitest

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

```bash
npm install node-cron resend
npm install --save-dev @types/node-cron
```

**Step 2: Verify installation**

```bash
node -e "require('node-cron'); require('resend'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add node-cron and resend dependencies"
```

---

### Task 2: Add `Schedule` type to `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add the type** — append to the end of `lib/types.ts`:

```ts
// A saved recurring scan schedule
export interface Schedule {
  id: string;
  name: string;
  cronExpression: string;        // e.g. "0 9 1 * *"
  config: {
    targetUrl: string;
    maxPages: 10 | 50 | 100 | 200;
    maxDepth?: number;
  };
  enabled: boolean;
  createdAt: string;             // ISO
  lastRunAt?: string;            // ISO
  lastScanId?: string;
  lastRunSummary?: {
    totalIssues: number;
    criticalCount: number;
    errorCount: number;
  };
  nextRunAt?: string;            // ISO — computed from cronExpression
  notification: {
    email?: string;
  };
}
```

**Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add Schedule type"
```

---

### Task 3: Create `lib/schedules.ts` — disk persistence

**Files:**
- Create: `lib/schedules.ts`

**Step 1: Write the file**

```ts
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Schedule } from "./types";

const SCHEDULES_FILE = path.join(process.cwd(), "schedules.json");

export function loadSchedules(): Schedule[] {
  if (!fs.existsSync(SCHEDULES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SCHEDULES_FILE, "utf-8")) as Schedule[];
  } catch {
    return [];
  }
}

export function saveSchedules(schedules: Schedule[]): void {
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), "utf-8");
}

export function createSchedule(
  data: Omit<Schedule, "id" | "createdAt">
): Schedule {
  const schedules = loadSchedules();
  const schedule: Schedule = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  schedules.push(schedule);
  saveSchedules(schedules);
  return schedule;
}

export function getSchedule(id: string): Schedule | undefined {
  return loadSchedules().find((s) => s.id === id);
}

export function updateSchedule(
  id: string,
  updates: Partial<Schedule>
): Schedule | null {
  const schedules = loadSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  schedules[idx] = { ...schedules[idx], ...updates };
  saveSchedules(schedules);
  return schedules[idx];
}

export function deleteSchedule(id: string): boolean {
  const schedules = loadSchedules();
  const filtered = schedules.filter((s) => s.id !== id);
  if (filtered.length === schedules.length) return false;
  saveSchedules(filtered);
  return true;
}
```

**Step 2: Add `schedules.json` to `.gitignore`**

Append to `.gitignore`:
```
schedules.json
```

**Step 3: Write unit tests** — create `lib/schedules.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Point to a temp file during tests
const TEST_FILE = path.join(process.cwd(), "schedules.test-tmp.json");

// We need to mock the file path — easiest to test via the exported functions
// after overriding the module-level constant via vi.mock or just testing behavior

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
```

**Step 4: Run tests**

```bash
npx vitest run lib/schedules.test.ts
```
Expected: 4 tests pass

**Step 5: Commit**

```bash
git add lib/schedules.ts lib/schedules.test.ts .gitignore
git commit -m "feat: add schedule persistence (lib/schedules.ts)"
```

---

### Task 4: Create `lib/scheduler.ts` — cron job manager + scan runner

**Files:**
- Create: `lib/scheduler.ts`

**Step 1: Write the file**

```ts
import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { loadSchedules, updateSchedule } from "./schedules";
import { crawl } from "./crawler";
import { scanPages } from "./scanner";
import { analyzeViolations } from "./analyzer";
import { saveScanReport, computeSummary } from "./report";
import { createJob, updateJob } from "./queue";
import type { Schedule } from "./types";

// Map from schedule ID to its active cron task
const tasks = new Map<string, cron.ScheduledTask>();

export function computeNextRunAt(cronExpression: string): string | undefined {
  try {
    // node-cron doesn't expose next-fire time directly; we use a simple approach:
    // validate the expression and return undefined if invalid
    if (!cron.validate(cronExpression)) return undefined;
    // Return a placeholder — real next-run is managed by node-cron internally
    return new Date(Date.now() + 60_000).toISOString(); // at least 1 min from now
  } catch {
    return undefined;
  }
}

async function runScheduledScan(schedule: Schedule): Promise<void> {
  const scanId = uuidv4();
  const startedAt = new Date().toISOString();

  try {
    createJob({
      id: scanId,
      status: "crawling",
      config: schedule.config,
      startedAt,
      progress: { scannedCount: 0, totalCount: 0 },
    });

    // 1. Crawl
    const { urls, headless } = await crawl(
      schedule.config.targetUrl,
      schedule.config.maxPages,
      schedule.config.maxDepth
    );
    updateJob(scanId, {
      status: "scanning",
      crawledUrls: urls,
      headless,
      progress: { scannedCount: 0, totalCount: urls.length },
    });

    // 2. Scan
    const urlStrings = urls.map((u) => u.url);
    let scannedCount = 0;
    const pageResults = await scanPages(
      urlStrings,
      () => {
        scannedCount++;
        updateJob(scanId, { progress: { scannedCount, totalCount: urls.length } });
      },
      headless
    );

    // 3. Analyse
    updateJob(scanId, { status: "analyzing" });
    const issues = await analyzeViolations(pageResults, schedule.config.targetUrl);
    const summary = computeSummary(issues);

    const report = {
      scanId,
      targetUrl: schedule.config.targetUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      pagesScanned: pageResults.length,
      issues,
      summary,
    };

    // 4. Save
    saveScanReport(scanId, report);
    updateJob(scanId, { status: "done", report });

    // 5. Update schedule metadata
    const lastRunSummary = {
      totalIssues: summary.totalIssues,
      criticalCount: summary.bySeverity.critical,
      errorCount: summary.bySeverity.serious,
    };
    updateSchedule(schedule.id, {
      lastRunAt: new Date().toISOString(),
      lastScanId: scanId,
      lastRunSummary,
    });

    // 6. Send email notification
    if (schedule.notification.email) {
      await sendEmail(schedule, scanId, lastRunSummary);
    }
  } catch (err) {
    updateJob(scanId, {
      status: "error",
      error: err instanceof Error ? err.message : "Scheduled scan failed",
    });
    updateSchedule(schedule.id, { lastRunAt: new Date().toISOString() });
  }
}

async function sendEmail(
  schedule: Schedule,
  scanId: string,
  summary: { totalIssues: number; criticalCount: number; errorCount: number }
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from || !schedule.notification.email) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from,
      to: schedule.notification.email,
      subject: `A11y Scan Complete: ${schedule.name}`,
      html: `
        <h2>Accessibility Scan Complete</h2>
        <p><strong>Schedule:</strong> ${schedule.name}</p>
        <p><strong>Site:</strong> ${schedule.config.targetUrl}</p>
        <p><strong>Total issues:</strong> ${summary.totalIssues}</p>
        <p><strong>Critical:</strong> ${summary.criticalCount} &nbsp; <strong>Serious:</strong> ${summary.errorCount}</p>
        <p><a href="http://localhost:3000/scan/${scanId}">View full report →</a></p>
      `,
    });
  } catch (err) {
    console.error("[scheduler] Email send failed:", err);
  }
}

export function registerSchedule(schedule: Schedule): void {
  if (!schedule.enabled) return;
  if (!cron.validate(schedule.cronExpression)) {
    console.warn(`[scheduler] Invalid cron expression for "${schedule.name}": ${schedule.cronExpression}`);
    return;
  }

  const task = cron.schedule(schedule.cronExpression, () => {
    console.log(`[scheduler] Firing schedule "${schedule.name}" (${schedule.id})`);
    runScheduledScan(schedule).catch((err) =>
      console.error(`[scheduler] Uncaught error in schedule ${schedule.id}:`, err)
    );
  });

  tasks.set(schedule.id, task);
}

export function unregisterSchedule(id: string): void {
  const task = tasks.get(id);
  if (task) {
    task.stop();
    tasks.delete(id);
  }
}

export function initScheduler(): void {
  const schedules = loadSchedules();
  console.log(`[scheduler] Initialising — registering ${schedules.filter((s) => s.enabled).length} active schedules`);
  for (const schedule of schedules) {
    registerSchedule(schedule);
  }
}

export async function triggerNow(scheduleId: string): Promise<string> {
  const { getSchedule } = await import("./schedules");
  const schedule = getSchedule(scheduleId);
  if (!schedule) throw new Error("Schedule not found");
  const scanId = uuidv4();
  // Run in background — don't await
  runScheduledScan({ ...schedule }).catch(console.error);
  return scanId;
}
```

**Step 2: Commit**

```bash
git add lib/scheduler.ts
git commit -m "feat: add scheduler with node-cron and scan pipeline (lib/scheduler.ts)"
```

---

### Task 5: Create `instrumentation.ts` — boot scheduler on server start

**Files:**
- Create: `instrumentation.ts` (project root, next to `package.json`)

**Step 1: Write the file**

```ts
export async function register() {
  // Only run on the Node.js server (not in the Edge runtime or during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScheduler } = await import("./lib/scheduler");
    initScheduler();
  }
}
```

**Step 2: Enable instrumentation in `next.config.ts`**

Open `next.config.ts`. Add `experimental.instrumentationHook: true` if it's not already present. If the file exports a config object:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

**Step 3: Restart dev server and check console**

```bash
# Stop existing server (Ctrl+C), then:
npm run dev
```
Expected in terminal: `[scheduler] Initialising — registering 0 active schedules`

**Step 4: Commit**

```bash
git add instrumentation.ts next.config.ts
git commit -m "feat: boot scheduler via Next.js instrumentation hook"
```

---

### Task 6: API routes for schedules

**Files:**
- Create: `app/api/schedules/route.ts`
- Create: `app/api/schedules/[id]/route.ts`
- Create: `app/api/schedules/[id]/run/route.ts`

**Step 1: Create `app/api/schedules/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { loadSchedules, createSchedule } from "@/lib/schedules";
import { registerSchedule } from "@/lib/scheduler";
import cron from "node-cron";

export async function GET() {
  return NextResponse.json(loadSchedules());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, cronExpression, config, notification } = body as {
    name: string;
    cronExpression: string;
    config: { targetUrl: string; maxPages: 10 | 50 | 100 | 200; maxDepth?: number };
    notification: { email?: string };
  };

  if (!name || !cronExpression || !config?.targetUrl) {
    return NextResponse.json({ error: "name, cronExpression and config.targetUrl are required" }, { status: 400 });
  }

  if (!cron.validate(cronExpression)) {
    return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
  }

  try { new URL(config.targetUrl); }
  catch { return NextResponse.json({ error: "Invalid targetUrl" }, { status: 400 }); }

  const schedule = createSchedule({ name, cronExpression, config, enabled: true, notification });
  registerSchedule(schedule);

  return NextResponse.json(schedule, { status: 201 });
}
```

**Step 2: Create `app/api/schedules/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSchedule, updateSchedule, deleteSchedule } from "@/lib/schedules";
import { registerSchedule, unregisterSchedule } from "@/lib/scheduler";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schedule = getSchedule(id);
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(schedule);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updates = await request.json() as Partial<import("@/lib/types").Schedule>;
  const updated = updateSchedule(id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-register to pick up enabled/cron changes
  unregisterSchedule(id);
  registerSchedule(updated);

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  unregisterSchedule(id);
  const deleted = deleteSchedule(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

**Step 3: Create `app/api/schedules/[id]/run/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { triggerNow } from "@/lib/scheduler";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await triggerNow(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 404 }
    );
  }
}
```

**Step 4: Commit**

```bash
git add app/api/schedules/
git commit -m "feat: add /api/schedules CRUD and manual-run endpoints"
```

---

### Task 7: Schedule list page (`/schedules`)

**Files:**
- Create: `app/schedules/page.tsx`

**Step 1: Write the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Schedule } from "@/lib/types";

function frequencyLabel(cron: string): string {
  if (cron.match(/^0 \d+ \* \* \*$/)) return "Daily";
  if (cron.match(/^0 \d+ \* \* 1$/)) return "Weekly (Mon)";
  if (cron.match(/^0 \d+ 1 \* \*$/)) return "Monthly";
  return cron;
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSchedules() {
    const res = await fetch("/api/schedules");
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchSchedules(); }, []);

  async function toggleEnabled(s: Schedule) {
    await fetch(`/api/schedules/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    fetchSchedules();
  }

  async function runNow(id: string) {
    await fetch(`/api/schedules/${id}/run`, { method: "POST" });
    alert("Scan started! Check back in a few minutes.");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    fetchSchedules();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
            <p className="text-sm text-gray-500 mt-1">Recurring accessibility scans</p>
          </div>
          <Link
            href="/schedules/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New schedule
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : schedules.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500 mb-4">No schedules yet.</p>
            <Link href="/schedules/new" className="text-indigo-600 underline text-sm">
              Create your first schedule →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Frequency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last run</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Enabled</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-gray-400 text-xs truncate max-w-xs">{s.config.targetUrl}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{frequencyLabel(s.cronExpression)}</td>
                    <td className="px-4 py-3">
                      {s.lastRunAt ? (
                        <div>
                          <p className="text-gray-600">{new Date(s.lastRunAt).toLocaleDateString()}</p>
                          {s.lastRunSummary && (
                            <p className="text-xs">
                              <span className="text-gray-500">{s.lastRunSummary.totalIssues} issues</span>
                              {s.lastRunSummary.criticalCount > 0 && (
                                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-medium">
                                  {s.lastRunSummary.criticalCount} critical
                                </span>
                              )}
                            </p>
                          )}
                          {s.lastScanId && (
                            <Link href={`/scan/${s.lastScanId}`} className="text-xs text-indigo-600 underline">
                              View report
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEnabled(s)}
                        aria-label={s.enabled ? "Disable schedule" : "Enable schedule"}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          s.enabled ? "bg-indigo-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            s.enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => runNow(s.id)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Run now
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="text-xs text-red-500 hover:underline"
                          aria-label={`Delete schedule ${s.name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add app/schedules/page.tsx
git commit -m "feat: add /schedules list page"
```

---

### Task 8: Schedule create form (`/schedules/new`)

**Files:**
- Create: `components/ScheduleForm.tsx`
- Create: `app/schedules/new/page.tsx`

**Step 1: Create `components/ScheduleForm.tsx`**

```tsx
"use client";

import { useState } from "react";

type Frequency = "daily" | "weekly" | "monthly" | "custom";

function buildCron(frequency: Frequency, time: string, customExpr: string): string {
  const [hh, mm] = time.split(":").map(Number);
  const h = isNaN(hh) ? 9 : hh;
  const m = isNaN(mm) ? 0 : mm;
  if (frequency === "daily") return `${m} ${h} * * *`;
  if (frequency === "weekly") return `${m} ${h} * * 1`;
  if (frequency === "monthly") return `${m} ${h} 1 * *`;
  return customExpr;
}

interface ScheduleFormProps {
  onSubmit: (data: {
    name: string;
    cronExpression: string;
    config: { targetUrl: string; maxPages: 10 | 50 | 100 | 200; maxDepth?: number };
    notification: { email?: string };
  }) => Promise<void>;
  loading: boolean;
  error: string;
}

export function ScheduleForm({ onSubmit, loading, error }: ScheduleFormProps) {
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [time, setTime] = useState("09:00");
  const [customCron, setCustomCron] = useState("");
  const [maxPages, setMaxPages] = useState<10 | 50 | 100 | 200>(50);
  const [maxDepth, setMaxDepth] = useState<string>("unlimited");
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cronExpression = buildCron(frequency, time, customCron);
    await onSubmit({
      name,
      cronExpression,
      config: {
        targetUrl,
        maxPages,
        maxDepth: maxDepth === "unlimited" ? undefined : Number(maxDepth),
      },
      notification: { email: email || undefined },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Schedule name <span aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monthly audit"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
          URL to scan <span aria-hidden="true">*</span>
        </label>
        <input
          id="url"
          type="url"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Frequency</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["daily", "weekly", "monthly", "custom"] as Frequency[]).map((f) => (
            <label
              key={f}
              className={`flex items-center justify-center rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                frequency === f
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={f}
                checked={frequency === f}
                onChange={() => setFrequency(f)}
                className="sr-only"
              />
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

      {frequency !== "custom" ? (
        <div>
          <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
            Run at
          </label>
          <input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="cron" className="block text-sm font-medium text-gray-700 mb-1">
            Cron expression
          </label>
          <input
            id="cron"
            required={frequency === "custom"}
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 9 * * 1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-400">minute hour day month weekday</p>
        </div>
      )}

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Max pages</legend>
        <div className="flex gap-3">
          {([10, 50, 100, 200] as const).map((n) => (
            <label key={n} className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="maxPages"
                value={n}
                checked={maxPages === n}
                onChange={() => setMaxPages(n)}
                className="accent-indigo-600"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="depth" className="block text-sm font-medium text-gray-700 mb-1">
          Max crawl depth
        </label>
        <select
          id="depth"
          value={maxDepth}
          onChange={(e) => setMaxDepth(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="unlimited">Unlimited</option>
          <option value="1">1 level</option>
          <option value="2">2 levels</option>
          <option value="3">3 levels</option>
        </select>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Notification email <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create schedule"}
      </button>
    </form>
  );
}
```

**Step 2: Create `app/schedules/new/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScheduleForm } from "@/components/ScheduleForm";

export default function NewSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: Parameters<typeof ScheduleForm>[0]["onSubmit"] extends (d: infer D) => unknown ? D : never) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create schedule");
      }
      router.push("/schedules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <Link href="/schedules" className="text-sm text-indigo-600 hover:underline">
            ← Back to schedules
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-2">New schedule</h1>
          <p className="text-sm text-gray-500">Set up a recurring accessibility scan.</p>
        </div>
        <ScheduleForm onSubmit={handleSubmit} loading={loading} error={error} />
      </div>
    </main>
  );
}
```

**Step 3: Commit**

```bash
git add components/ScheduleForm.tsx app/schedules/new/page.tsx
git commit -m "feat: add schedule creation form and /schedules/new page"
```

---

### Task 9: Add "Schedules" nav link to home page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Add nav link to the top of the card** — in `app/page.tsx`, add a link after the opening `<div className="w-full max-w-lg ...">`:

```tsx
// Add this import at the top:
import Link from "next/link";

// Add this just before <h1 ...> inside the card div:
<div className="flex justify-end mb-4">
  <Link href="/schedules" className="text-sm text-indigo-600 hover:underline">
    Schedules →
  </Link>
</div>
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Schedules nav link to home page"
```

---

### Task 10: Update `.env.local` documentation + README

**Files:**
- Modify: `.env.local` (add placeholder lines)
- Modify: `README.md`

**Step 1: Append to `.env.local`**

```bash
# Resend email notifications (optional)
RESEND_API_KEY=re_your_key_here
RESEND_FROM=a11y-scanner@yourdomain.com
```

**Step 2: Add scheduling section to README.md** — find the existing environment variables section and add:

```markdown
## Scheduled Scans

Create recurring scans from the **Schedules** page (`/schedules`).

Schedules are stored in `schedules.json` (gitignored). The cron scheduler starts automatically with the dev server.

### Email notifications (optional)

Add to `.env.local`:

```
RESEND_API_KEY=re_your_key_here
RESEND_FROM=noreply@yourdomain.com
```

Get a free API key at [resend.com](https://resend.com).
```

**Step 3: Update CHANGELOG.md** — add a new entry at the top:

```markdown
## [0.2.0] - 2026-03-08

### Added
- Scheduled recurring scans (daily, weekly, monthly, custom cron)
- Email notifications via Resend when scheduled scans complete
- `/schedules` management page with enable/disable toggle and run-now button
- `/schedules/new` create form
```

**Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document scheduled scans and Resend email setup"
```

---

### Task 11: End-to-end verification

**Step 1: Restart dev server and check scheduler boots**

```bash
npm run dev
```
Expected in terminal: `[scheduler] Initialising — registering 0 active schedules`

**Step 2: Open app and navigate to Schedules**

Open `http://localhost:3000` → click "Schedules →" → should show empty state.

**Step 3: Create a test schedule**

- Click "New schedule"
- Name: `Test schedule`
- URL: `https://example.com`
- Frequency: Custom, expression: a time 2 minutes from now e.g. `*/2 * * * *`
- Max pages: 10
- Submit → redirects to `/schedules` list

**Step 4: Wait 2 minutes, check results**

- Refresh `/schedules` — "Last run" column should show today's date with issue count
- Check `reports/` folder for a new JSON file
- Check `schedules.json` for `lastRunAt` and `lastScanId` fields

**Step 5: Test "Run now"**

- Click "Run now" on the schedule → alert appears
- Wait ~30 seconds → refresh page → new `lastRunAt`

**Step 6: Test disable toggle**

- Toggle enabled to OFF → schedule stops firing

**Step 7: Test delete**

- Click Delete → confirm → schedule removed from list and `schedules.json`

**Step 8: Run unit tests**

```bash
npm test
```
Expected: all tests pass including `lib/schedules.test.ts`
