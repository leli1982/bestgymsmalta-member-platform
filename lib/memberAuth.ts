import { NextResponse } from "next/server";
import { resolveMemberSessionSecret } from "@/lib/memberServerSession";

function getMemberSecret() {
  const secret = resolveMemberSessionSecret({
    BGM_MEMBER_SESSION_SECRET: process.env.BGM_MEMBER_SESSION_SECRET,
    BGM_ADMIN_SESSION_SECRET: process.env.BGM_ADMIN_SESSION_SECRET,
    BGM_ADMIN_PIN: process.env.BGM_ADMIN_PIN,
  });

  if (!secret) {
    throw new Error("Missing BGM member session secret.");
  }

  return secret;
}

export function setMemberSessionCookie(
  response: NextResponse,
  _memberId: string
) {
  getMemberSecret();
  return response;
}
