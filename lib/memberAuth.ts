import { NextRequest, NextResponse } from "next/server";
import {
  createMemberSessionToken,
  getClearedMemberSessionCookieOptions,
  getMemberSessionCookieOptions,
  resolveMemberSessionSecret,
  verifyMemberRequestToken,
  type MemberServerSession,
} from "@/lib/memberServerSession";

const MEMBER_COOKIE_NAME = "bgm_member_session";
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

export function getMemberRequestSession(
  request: NextRequest,
  requestedMemberId?: string
): MemberServerSession | null {
  const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
  return verifyMemberRequestToken(token, getMemberSecret(), requestedMemberId);
}

export function requireMemberSession(
  request: NextRequest,
  requestedMemberId?: string
) {
  const session = getMemberRequestSession(request, requestedMemberId);

  if (session) return null;

  return NextResponse.json(
    { error: "Member session required. Please log in again." },
    { status: 401 }
  );
}

export function setMemberSessionCookie(
  response: NextResponse,
  memberId: string
) {
  const token = createMemberSessionToken(memberId, getMemberSecret(), {
    ttlMs: MEMBER_SESSION_TTL_MS,
  });

  response.cookies.set(
    MEMBER_COOKIE_NAME,
    token,
    getMemberSessionCookieOptions(process.env.NODE_ENV === "production")
  );

  return response;
}

export function clearMemberSessionCookie(response: NextResponse) {
  response.cookies.set(
    MEMBER_COOKIE_NAME,
    "",
    getClearedMemberSessionCookieOptions(process.env.NODE_ENV === "production")
  );

  return response;
}
