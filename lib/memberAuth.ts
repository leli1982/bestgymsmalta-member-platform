import { NextResponse } from "next/server";
import { resolveMemberSessionSecret } from "@/lib/memberServerSession";

function getMemberSecret() {
  const secret = resolveMemberSessionSecret(process.env);

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
