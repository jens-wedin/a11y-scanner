import { getSql, ensureSchema } from "./db";
import type { ScanJob, ScanEvent } from "./types";

/**
 * Job state lives in Postgres: /api/scan/start and the SSE progress route are
 * separate invocations, and Fluid Compute guarantees no instance affinity, so a
 * module-scope Map produced intermittent "Scan job not found".
 *
 * SSE controllers stay in memory deliberately — a ReadableStream controller
 * cannot be serialised, and it does not need to be: the scan runs inside the
 * same invocation that holds the stream open.
 */
const controllers = new Map<
  string,
  ReadableStreamDefaultController<Uint8Array>
>();

export async function createJob(job: ScanJob): Promise<void> {
  await ensureSchema();
  await getSql()`
    insert into scan_jobs (id, data) values (${job.id}, ${JSON.stringify(job)})
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;
}

export async function getJob(id: string): Promise<ScanJob | undefined> {
  await ensureSchema();
  const rows = await getSql()`select data from scan_jobs where id = ${id}`;
  return rows.length ? (rows[0].data as ScanJob) : undefined;
}

export async function updateJob(
  id: string,
  updates: Partial<ScanJob>
): Promise<void> {
  const job = await getJob(id);
  if (!job) return;

  const merged: ScanJob = {
    ...job,
    ...updates,
    progress: updates.progress
      ? { ...job.progress, ...updates.progress }
      : job.progress,
  };

  await getSql()`
    update scan_jobs set data = ${JSON.stringify(merged)}, updated_at = now()
    where id = ${id}
  `;
}

export async function deleteJob(id: string): Promise<void> {
  await ensureSchema();
  await getSql()`delete from scan_jobs where id = ${id}`;
}

/** Test helper only */
export async function clearAllJobs(): Promise<void> {
  await ensureSchema();
  await getSql()`delete from scan_jobs`;
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
