import { NextResponse } from "next/server";
import {
  createMemberSessionToken,
  resolveMemberSessionSecret,
} from "@/lib/memberServerSession";

const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getMemberSecret() {
  const secret = resolveMemberSessionSecret(process.env);

  if (!secret) {
    throw new Error("Missing BGM member session secret.");
  }

  return secret;
}

export function setMemberSessionCookie(
  response: NextResponse,
  memberId: string
) {
  createMemberSessionToken(memberId, getMemberSecret(), {
    ttlMs: MEMBER_SESSION_TTL_MS,
  });

  return response;
}
