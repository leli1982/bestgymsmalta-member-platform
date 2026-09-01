import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createMemberSessionToken(memberId, secret, options = {}) {
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

export function verifyMemberSessionToken(token, secret, options = {}) {
  if (!token || !secret || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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
  token,
  secret,
  requestedMemberId,
  options = {}
) {
  const session = verifyMemberSessionToken(token, secret, options);

  if (!session) return null;
  if (requestedMemberId && session.memberId !== requestedMemberId) return null;

  return session;
}

export function getMemberSessionCookieOptions(isProduction) {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: Boolean(isProduction),
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  };
}
