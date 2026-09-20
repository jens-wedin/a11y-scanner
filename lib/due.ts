import { CronExpressionParser } from "cron-parser";
import type { Schedule } from "./types";

/**
 * Whether a schedule should fire now.
 *
 * `node-cron` kept its own timers inside the server process, which never worked
 * on Vercel: functions are not always-on, so the timers died with the instance
 * and schedules simply never fired. Vercel Cron instead pokes a route on an
 * interval, and that route has to decide which schedules are actually due —
 * hence this being a pure function of the schedule and the current time.
 */

/** A run still marked in-flight after this long is treated as abandoned. */
export const STALE_RUN_MS = 60 * 60 * 1000; // 1 hour

export function isDue(schedule: Schedule, now: Date = new Date()): boolean {
  if (!schedule.enabled) return false;

  // Don't start a second run on top of one already going, but don't let a
  // crashed run wedge the schedule permanently either.
  if (schedule.runningAt) {
    const startedAt = new Date(schedule.runningAt).getTime();
    const stalled = now.getTime() - startedAt > STALE_RUN_MS;
    if (!stalled) return false;
  }

  let previousOccurrence: Date;
  try {
    previousOccurrence = CronExpressionParser.parse(schedule.cronExpression, {
      currentDate: now,
    })
      .prev()
      .toDate();
  } catch {
    // An unparseable expression should be inert, not an exception on every tick.
    return false;
  }

  if (!schedule.lastRunAt) return true;

  return new Date(schedule.lastRunAt).getTime() < previousOccurrence.getTime();
}

/** The subset of schedules that should run now. */
export function dueSchedules(
  schedules: Schedule[],
  now: Date = new Date()
): Schedule[] {
  return schedules.filter((s) => isDue(s, now));
}

/**
 * Whether a cron expression parses. Replaces node-cron's `validate`, which went
 * away with the in-process scheduler.
 */
export function isValidCron(expression: string): boolean {
  if (!expression.trim()) return false;
  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}
