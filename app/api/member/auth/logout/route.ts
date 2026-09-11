import { NextResponse } from "next/server";
import { clearMemberSessionCookie } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    message: "Logged out.",
  });

  return clearMemberSessionCookie(response);
}
