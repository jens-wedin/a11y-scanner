import { NextRequest, NextResponse } from "next/server";
import { getSchedule, updateSchedule, deleteSchedule } from "@/lib/schedules";
import { assertScannableUrl, BlockedUrlError } from "@/lib/url-guard";
import { isValidCron } from "@/lib/due";
import type { Schedule } from "@/lib/types";

const VALID_MAX_PAGES = [10, 50, 100, 200] as const;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Builds a patch containing only client-owned fields, each validated.
 *
 * Spreading the raw body would let a caller bypass the checks POST performs
 * (and overwrite server-owned fields like `id` and `createdAt`), so every
 * accepted key is listed explicitly.
 */
async function buildUpdate(
  body: Record<string, unknown>
): Promise<Partial<Schedule> | { error: string }> {
  const updates: Partial<Schedule> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "name must be a non-empty string" };
    }
    updates.name = body.name;
  }

  if (body.cronExpression !== undefined) {
    if (
      typeof body.cronExpression !== "string" ||
      !isValidCron(body.cronExpression)
    ) {
      return { error: "Invalid cron expression" };
    }
    updates.cronExpression = body.cronExpression;
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return { error: "enabled must be a boolean" };
    }
    updates.enabled = body.enabled;
  }

  if (body.config !== undefined) {
    const config = body.config as Record<string, unknown>;
    if (typeof config !== "object" || config === null) {
      return { error: "config must be an object" };
    }

    if (typeof config.targetUrl !== "string") {
      return { error: "config.targetUrl is required" };
    }
    try {
      await assertScannableUrl(config.targetUrl);
    } catch (err) {
      if (err instanceof BlockedUrlError) return { error: err.message };
      throw err;
    }

    if (!VALID_MAX_PAGES.includes(config.maxPages as never)) {
      return { error: `config.maxPages must be one of: ${VALID_MAX_PAGES.join(", ")}` };
    }

    if (
      config.maxDepth !== undefined &&
      (typeof config.maxDepth !== "number" || config.maxDepth < 0)
    ) {
      return { error: "config.maxDepth must be a non-negative number" };
    }

    updates.config = {
      targetUrl: config.targetUrl,
      maxPages: config.maxPages as Schedule["config"]["maxPages"],
      ...(config.maxDepth !== undefined
        ? { maxDepth: config.maxDepth as number }
        : {}),
    };
  }

  if (body.notification !== undefined) {
    const notification = body.notification as Record<string, unknown>;
    if (typeof notification !== "object" || notification === null) {
      return { error: "notification must be an object" };
    }
    const email = notification.email;
    if (email !== undefined) {
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "notification.email must be a valid email address" };
      }
    }
    updates.notification = email !== undefined ? { email } : {};
  }

  return updates;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const schedule = await getSchedule(id);
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(schedule);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!await getSchedule(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const result = await buildUpdate(body);
  if ("error" in result) return badRequest(result.error as string);

  const updated = await updateSchedule(id, result);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteSchedule(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
