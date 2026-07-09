import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const ADMIN_COOKIE_NAME = "bgm_admin_session";
const SESSION_HOURS = 8;

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getAdminSecret() {
  return (
    process.env.BGM_ADMIN_SESSION_SECRET ||
    process.env.BGM_ADMIN_PIN ||
    "missing-admin-secret"
  );
}

function sign(payload: string) {
  return base64Url(
    createHmac("sha256", getAdminSecret()).update(payload).digest()
  );
}

export function createAdminSessionToken() {
  const payload = JSON.stringify({
    iat: Date.now(),
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    nonce: randomBytes(16).toString("hex"),
  });

  const encodedPayload = base64Url(payload);
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string) {
  if (!token || !token.includes(".")) return false;

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) return false;

  const expectedSignature = sign(encodedPayload);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64").toString("utf8")
    );

    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export function requireAdmin(request: NextRequest) {
  if (isAdminRequest(request)) return null;

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });

  return response;
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
