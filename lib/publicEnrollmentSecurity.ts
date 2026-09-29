import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export const PUBLIC_IDENTITY_CHECKS_PER_HOUR = 600;
export const PUBLIC_SUBMISSIONS_PER_HOUR = 120;

function firstForwardedAddress(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function resolveClientIp(request: NextRequest): string {
  return (
    firstForwardedAddress(request.headers.get("x-vercel-forwarded-for")) ||
    firstForwardedAddress(request.headers.get("x-forwarded-for")) ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function requirePublicEnrollmentRateSalt(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = String(env.BGM_PUBLIC_ENROLLMENT_RATE_SALT || "").trim();
  if (!value) {
    throw new Error("Public enrollment rate-limit salt is not configured.");
  }
  return value;
}

export function hourlyRateWindow(now = new Date()): string {
  const value = new Date(now);
  value.setUTCMinutes(0, 0, 0);
  return value.toISOString();
}

export function hashPublicRateKey(input: {
  ip: string;
  gymSlug: string;
  action: "identity_check" | "submission";
  windowStart: string;
  secret: string;
}): string {
  const payload = [
    input.secret,
    input.action,
    input.gymSlug.trim().toLowerCase(),
    input.ip.trim() || "unknown",
    input.windowStart,
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex");
}
