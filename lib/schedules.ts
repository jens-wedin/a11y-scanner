import { v4 as uuidv4 } from "uuid";
import { getSql, ensureSchema } from "./db";
import type { Schedule } from "./types";

/**
 * Schedules live in Postgres rather than schedules.json — Vercel's filesystem
 * is read-only outside /tmp and is not shared between instances.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Schedule ids arrive from route params and are compared against a uuid column,
 * where a malformed value raises a Postgres type error rather than matching
 * nothing. Screening here keeps "unknown id" a clean 404 instead of a 500.
 */
function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function loadSchedules(): Promise<Schedule[]> {
  await ensureSchema();
  const rows = await getSql()`
    select data from schedules order by created_at asc
  `;
  return rows.map((r) => r.data as Schedule);
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`delete from schedules`;
  for (const schedule of schedules) {
    await sql`
      insert into schedules (id, data) values (${schedule.id}, ${JSON.stringify(schedule)})
    `;
  }
}

export async function createSchedule(
  data: Omit<Schedule, "id" | "createdAt">
): Promise<Schedule> {
  await ensureSchema();
  const schedule: Schedule = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  await getSql()`
    insert into schedules (id, data) values (${schedule.id}, ${JSON.stringify(schedule)})
  `;
  return schedule;
}

export async function getSchedule(id: string): Promise<Schedule | undefined> {
  if (!isValidId(id)) return undefined;
  await ensureSchema();
  const rows = await getSql()`select data from schedules where id = ${id}`;
  return rows.length ? (rows[0].data as Schedule) : undefined;
}

export async function updateSchedule(
  id: string,
  updates: Partial<Schedule>
): Promise<Schedule | null> {
  if (!isValidId(id)) return null;
  await ensureSchema();
  const existing = await getSchedule(id);
  if (!existing) return null;

  // Spreading then serialising drops keys set to undefined, which is how
  // callers clear a field (e.g. runningAt when a run finishes).
  const merged = { ...existing, ...updates } as Schedule;

  await getSql()`
    update schedules set data = ${JSON.stringify(merged)} where id = ${id}
  `;

  // Round-trip so the caller sees exactly what was stored.
  return (await getSchedule(id)) ?? null;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  await ensureSchema();
  const rows = await getSql()`
    delete from schedules where id = ${id} returning id
  `;
  return rows.length > 0;
}
