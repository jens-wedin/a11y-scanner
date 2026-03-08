import cron, { type ScheduledTask } from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { loadSchedules, getSchedule, updateSchedule } from "./schedules";
import { crawl } from "./crawler";
import { scanPages } from "./scanner";
import { analyzeViolations } from "./analyzer";
import { saveScanReport, computeSummary } from "./report";
import { createJob, updateJob } from "./queue";
import type { Schedule } from "./types";

// Map from schedule ID to its active cron task
const tasks = new Map<string, ScheduledTask>();

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
    console.warn(
      `[scheduler] Invalid cron expression for "${schedule.name}": ${schedule.cronExpression}`
    );
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
  const active = schedules.filter((s) => s.enabled).length;
  console.log(`[scheduler] Initialising — registering ${active} active schedules`);
  for (const schedule of schedules) {
    registerSchedule(schedule);
  }
}

export async function triggerNow(scheduleId: string): Promise<void> {
  const schedule = getSchedule(scheduleId);
  if (!schedule) throw new Error("Schedule not found");
  // Run in background — don't await
  runScheduledScan({ ...schedule }).catch(console.error);
}
