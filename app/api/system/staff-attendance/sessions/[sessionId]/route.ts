import { NextRequest, NextResponse } from "next/server";
import { correctStaffAttendanceSession } from "@/lib/staffAttendanceServer";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return clean(value) || null;
}

function optionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("A valid attendance timestamp is required.");
  return date.toISOString();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const { sessionId } = await params;
    const body = await request.json().catch(() => null);
    const reason = clean(body?.reason);
    const reviewMidnight = body?.reviewMidnight === true;
    if (!reason) {
      return NextResponse.json(
        { error: "A correction or review reason is required." },
        { status: 400, headers: noStore },
      );
    }

    const result = await correctStaffAttendanceSession({
      sessionId,
      clockInAt: optionalTimestamp(body?.clockInAt),
      clockInGymId: optionalText(body?.clockInGymId),
      clockOutAt: optionalTimestamp(body?.clockOutAt),
      clockOutGymId: optionalText(body?.clockOutGymId),
      reason,
      actorSystemUserId: auth.context.systemUserId,
      reviewMidnight,
    });

    return NextResponse.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    console.error("Could not correct staff attendance session", error);
    const message = error instanceof Error ? error.message : "";
    const safeMessage = /required|not found|after|overlap|does not exist|midnight/i.test(message)
      ? message
      : "Could not update the attendance session.";
    return NextResponse.json(
      { error: safeMessage },
      { status: /not found/i.test(safeMessage) ? 404 : 400, headers: noStore },
    );
  }
}
