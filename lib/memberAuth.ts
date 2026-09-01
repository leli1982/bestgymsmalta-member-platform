import { NextResponse } from "next/server";
import {
  createMemberSessionToken,
  resolveMemberSessionSecret,
} from "@/lib/memberServerSession";

const MEMBER_COOKIE_NAME = "bgm_member_session";
const MEMBER_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MEMBER_SESSION_TTL_MS = MEMBER_SESSION_MAX_AGE_SECONDS * 1000;

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
  const token = createMemberSessionToken(memberId, getMemberSecret(), {
    ttlMs: MEMBER_SESSION_TTL_MS,
  });

  response.cookies.set(MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MEMBER_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
