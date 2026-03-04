import type { ScanJob, ScanEvent } from "./types";

// In-memory job store (suitable for local-first; replace with Redis/DB for multi-instance deployment)
const jobs = new Map<string, ScanJob>();

// SSE stream controllers keyed by scanId
const controllers = new Map<
  string,
  ReadableStreamDefaultController<Uint8Array>
>();

export function createJob(job: ScanJob): void {
  jobs.set(job.id, job);
}

export function getJob(id: string): ScanJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<ScanJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, {
    ...job,
    ...updates,
    progress: updates.progress
      ? { ...job.progress, ...updates.progress }
      : job.progress,
  });
}

export function deleteJob(id: string): void {
  jobs.delete(id);
}

/** Test helper only */
export function clearAllJobs(): void {
  jobs.clear();
  controllers.clear();
}

export function addController(
  id: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  controllers.set(id, controller);
}

export function removeController(id: string): void {
  controllers.delete(id);
}

export function sendEvent(id: string, event: ScanEvent): void {
  const controller = controllers.get(id);
  if (!controller) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}

export function closeStream(id: string): void {
  const controller = controllers.get(id);
  if (controller) {
    try {
      controller.close();
    } catch {
      // Already closed
    }
    controllers.delete(id);
  }
}
