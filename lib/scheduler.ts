import cron, { type ScheduledTask } from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { loadSchedules, getSchedule, updateSchedule } from "./schedules";
import { crawl } from "./crawler";
import { scanPages } from "./scanner";
import { analyzeViolations } from "./analyzer";
import { saveScanReport, computeSummary } from "./report";
import { createJob, updateJob } from "./queue";
import { getResendClient } from "./resend";
import { escapeHtml } from "./report-email";
import type { Schedule } from "./types";

// Map from schedule ID to its active cron task
const tasks = new Map<string, ScheduledTask>();

export interface RunSummary {
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
}

export function buildEmailHtml(
  schedule: Schedule,
  scanId: string,
  summary: RunSummary
): string {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  return `
    <h2>Accessibility Scan Complete</h2>
    <p><strong>Schedule:</strong> ${escapeHtml(schedule.name)}</p>
    <p><strong>Site:</strong> ${escapeHtml(schedule.config.targetUrl)}</p>
    <p><strong>Total issues:</strong> ${summary.totalIssues}</p>
    <p><strong>Critical:</strong> ${summary.criticalCount} &nbsp; <strong>Serious:</strong> ${summary.seriousCount}</p>
    <p><a href="${baseUrl}/report/${scanId}">View full report →</a></p>
  `;
}

export async function sendEmail(
  schedule: Schedule,
  scanId: string,
  summary: RunSummary
): Promise<void> {
  const from = process.env.RESEND_FROM;
  if (!from || !schedule.notification.email) return;

  const client = getResendClient();
  if (!client) return;

  try {
    await client.emails.send({
      from,
      to: schedule.notification.email,
      subject: `A11y Scan Complete: ${schedule.name}`,
      html: buildEmailHtml(schedule, scanId, summary),
    });
  } catch (err) {
    console.error("[scheduler] Email send failed:", err);
  }
}

async function runScheduledScan(schedule: Schedule): Promise<void> {
  const scanId = uuidv4();
  const startedAt = new Date().toISOString();

  try {
    await updateSchedule(schedule.id, { runningAt: startedAt });

    await createJob({
      id: scanId,
      status: "crawling",
      config: schedule.config,
      startedAt,
      progress: { scannedCount: 0, totalCount: 0 },
    });

    // 1. Crawl
    const urls = await crawl(
      schedule.config.targetUrl,
      schedule.config.maxPages,
      schedule.config.maxDepth
    );
    await updateJob(scanId, {
      status: "scanning",
      crawledUrls: urls,
      progress: { scannedCount: 0, totalCount: urls.length },
    });

    // 2. Scan
    const urlStrings = urls.map((u) => u.url);
    let scannedCount = 0;
    const pageResults = await scanPages(
      urlStrings,
      async () => {
        scannedCount++;
        await updateJob(scanId, { progress: { scannedCount, totalCount: urls.length } });
      }
    );

    // 3. Analyse
    await updateJob(scanId, { status: "analyzing" });
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
    await saveScanReport(scanId, report);
    await updateJob(scanId, { status: "done", report });

    // 5. Update schedule metadata
    const lastRunSummary: RunSummary = {
      totalIssues: summary.totalIssues,
      criticalCount: summary.bySeverity.critical,
      seriousCount: summary.bySeverity.serious,
    };
    await updateSchedule(schedule.id, {
      lastRunAt: new Date().toISOString(),
      lastScanId: scanId,
      lastRunSummary,
      runningAt: undefined,
    });

    // 6. Send email notification
    if (schedule.notification.email) {
      await sendEmail(schedule, scanId, lastRunSummary);
    }
  } catch (err) {
    await updateJob(scanId, {
      status: "error",
      error: err instanceof Error ? err.message : "Scheduled scan failed",
    });
    await updateSchedule(schedule.id, { lastRunAt: new Date().toISOString(), runningAt: undefined });
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

export async function initScheduler(): Promise<void> {
  const schedules = await loadSchedules();
  const active = schedules.filter((s) => s.enabled).length;
  console.log(`[scheduler] Initialising — registering ${active} active schedules`);
  for (const schedule of schedules) {
    registerSchedule(schedule);
  }
}

export async function triggerNow(scheduleId: string): Promise<void> {
  const schedule = await getSchedule(scheduleId);
  if (!schedule) throw new Error("Schedule not found");
  // Run in background — don't await
  runScheduledScan({ ...schedule }).catch(console.error);
}
