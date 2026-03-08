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
    return NextResponse.json(
      { error: "name, cronExpression and config.targetUrl are required" },
      { status: 400 }
    );
  }

  if (!cron.validate(cronExpression)) {
    return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
  }

  try {
    new URL(config.targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid targetUrl" }, { status: 400 });
  }

  const schedule = createSchedule({ name, cronExpression, config, enabled: true, notification });
  registerSchedule(schedule);

  return NextResponse.json(schedule, { status: 201 });
}
