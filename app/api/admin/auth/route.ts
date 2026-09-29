import { NextRequest, NextResponse } from "next/server";
import { getSystemContext } from "@/lib/systemAuth";
import {
  clearAdminSessionCookie,
  createAdminSessionToken,
  isAdminRequest,
  setAdminSessionCookie,
} from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isAdminRequest(request)) {
    return NextResponse.json({ authenticated: true, source: "admin_pin" });
  }

  const context = await getSystemContext(request);
  return NextResponse.json({
    authenticated: Boolean(context?.isSuperAdmin),
    source: context?.isSuperAdmin ? "super_admin" : null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = String(body.pin || "");

    if (!process.env.BGM_ADMIN_PIN || pin !== process.env.BGM_ADMIN_PIN) {
      return NextResponse.json(
        { error: "Incorrect admin PIN." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      authenticated: true,
      message: "Admin unlocked.",
    });

    return setAdminSessionCookie(response, createAdminSessionToken());
  } catch {
    return NextResponse.json(
      { error: "Could not unlock admin." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    authenticated: false,
    message: "Admin locked.",
  });

  return clearAdminSessionCookie(response);
}
