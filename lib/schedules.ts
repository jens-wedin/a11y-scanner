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
