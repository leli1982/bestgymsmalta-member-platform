import { NextRequest, NextResponse } from "next/server";
import {
  createMemberSessionToken,
  getMemberSessionCookieOptions,
  resolveMemberSessionSecret,
  verifyMemberRequestToken,
  verifyMemberSessionToken,
  type MemberServerSession,
} from "@/lib/memberServerSession";

const MEMBER_COOKIE_NAME = "bgm_member_session";
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getMemberSecret() {
  const secret = resolveMemberSessionSecret(process.env);

  if (!secret) {
    throw new Error("Missing BGM member session secret.");
  }

  return secret;
}

export function getMemberSession(request: NextRequest): MemberServerSession | null {
  const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
  return verifyMemberSessionToken(token, getMemberSecret());
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
  response.cookies.set(MEMBER_COOKIE_NAME, "", {
    ...getMemberSessionCookieOptions(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });

  return response;
}
