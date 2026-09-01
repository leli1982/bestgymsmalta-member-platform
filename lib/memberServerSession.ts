import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type MemberServerSession = {
  memberId: string;
  issuedAt: number;
  expiresAt: number;
};

type CreateSessionOptions = {
  now?: number;
  ttlMs?: number;
  nonce?: string;
};

type VerifySessionOptions = {
  now?: number;
};

type MemberSessionEnvironment = {
  BGM_MEMBER_SESSION_SECRET?: string;
  BGM_ADMIN_SESSION_SECRET?: string;
  BGM_ADMIN_PIN?: string;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createMemberSessionToken(
  memberId: string,
  secret: string,
  options: CreateSessionOptions = {}
) {
  if (!memberId || !secret) {
    throw new Error("Member ID and session secret are required.");
  }

  const issuedAt = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000;
  const expiresAt = issuedAt + ttlMs;
  const nonce = options.nonce ?? randomBytes(16).toString("hex");

  const payload = Buffer.from(
    JSON.stringify({ memberId, issuedAt, expiresAt, nonce })
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyMemberSessionToken(
  token: string | undefined,
  secret: string,
  options: VerifySessionOptions = {}
): MemberServerSession | null {
  if (!token || !secret || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<MemberServerSession>;
    const now = options.now ?? Date.now();

    if (
      typeof parsed.memberId !== "string" ||
      !parsed.memberId ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      return null;
    }

    return {
      memberId: parsed.memberId,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function verifyMemberRequestToken(
  token: string | undefined,
  secret: string,
  requestedMemberId: string | undefined,
  options: VerifySessionOptions = {}
): MemberServerSession | null {
  const session = verifyMemberSessionToken(token, secret, options);

  if (!session) return null;
  if (requestedMemberId && session.memberId !== requestedMemberId) return null;

  return session;
}

export function getMemberSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: Boolean(isProduction),
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  };
}

export function resolveMemberSessionSecret(
  env: MemberSessionEnvironment
): string | null {
  return (
    env.BGM_MEMBER_SESSION_SECRET ||
    env.BGM_ADMIN_SESSION_SECRET ||
    env.BGM_ADMIN_PIN ||
    null
  );
}
