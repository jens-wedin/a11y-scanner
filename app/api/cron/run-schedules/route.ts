import { NextRequest, NextResponse } from "next/server";
import { runDueSchedules } from "@/lib/scheduler";

/**
 * Invoked by Vercel Cron (see vercel.json).
 *
 * node-cron kept timers inside the server process, which never fired on Vercel
 * because functions are not always-on. Vercel Cron pokes this route instead,
 * and lib/due.ts decides which schedules are actually due.
 */

// A scan runs inline, so this needs the same headroom as the scan route.
export const maxDuration = 1800;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Fail closed. Without this, a deploy made before CRON_SECRET is configured
  // would expose an unauthenticated endpoint that starts scans.
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ran = await runDueSchedules();

  return NextResponse.json({ ran: ran.length, scheduleIds: ran });
}
