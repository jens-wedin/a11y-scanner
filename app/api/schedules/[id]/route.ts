import { NextRequest, NextResponse } from "next/server";
import { getSchedule, updateSchedule, deleteSchedule } from "@/lib/schedules";
import { registerSchedule, unregisterSchedule } from "@/lib/scheduler";
import type { Schedule } from "@/lib/types";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const schedule = getSchedule(id);
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(schedule);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = (await request.json()) as Partial<Schedule>;
  const updated = updateSchedule(id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-register to pick up enabled/cron changes
  unregisterSchedule(id);
  registerSchedule(updated);

  return NextResponse.json(updated);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  unregisterSchedule(id);
  const deleted = deleteSchedule(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
