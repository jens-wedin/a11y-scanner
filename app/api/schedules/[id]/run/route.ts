import { NextRequest, NextResponse } from "next/server";
import { triggerNow } from "@/lib/scheduler";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await triggerNow(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 404 }
    );
  }
}
