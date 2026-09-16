import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeIdentityDocument } from "@/lib/membershipRegistrationCore";
import type { IdentityMatchState } from "@/lib/membershipRegistrationTypes";
import {
  PUBLIC_IDENTITY_CHECKS_PER_HOUR,
  hashPublicRateKey,
  hourlyRateWindow,
  requirePublicEnrollmentRateSalt,
  resolveClientIp,
} from "@/lib/publicEnrollmentSecurity";

function cleanGymSlug(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isIdentityState(value: unknown): value is IdentityMatchState {
  return value === "clear" || value === "active" || value === "expired_inactive";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const gymSlug = cleanGymSlug(payload.gymSlug);
  const idNumber = normalizeIdentityDocument(String(payload.idNumber || ""));

  if (!gymSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymSlug) || !idNumber || idNumber.length > 80) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const { data: gym, error: gymError } = await supabase
    .from("bgm_gyms")
    .select("id,public_enrollment_slug,status")
    .eq("public_enrollment_slug", gymSlug)
    .eq("status", "active")
    .maybeSingle();

  if (gymError) {
    console.error("Public identity gym lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (!gym) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  let rateKeyHash: string;
  const windowStart = hourlyRateWindow();
  try {
    rateKeyHash = hashPublicRateKey({
      ip: resolveClientIp(request),
      gymSlug,
      action: "identity_check",
      windowStart,
      secret: requirePublicEnrollmentRateSalt(),
    });
  } catch {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const { data: allowed, error: rateError } = await supabase.rpc(
    "bgm_consume_public_enrollment_rate_limit",
    {
      p_rate_key_hash: rateKeyHash,
      p_enrollment_gym_id: gym.id,
      p_window_start: windowStart,
      p_limit: PUBLIC_IDENTITY_CHECKS_PER_HOUR,
    },
  );

  if (rateError) {
    console.error("Public identity rate-limit check failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { data: classification, error: classificationError } = await supabase.rpc(
    "bgm_classify_membership_identity",
    { p_id_number: idNumber },
  );

  if (classificationError) {
    console.error("Public identity classification failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const state =
    classification && typeof classification === "object"
      ? (classification as Record<string, unknown>).state
      : null;

  if (!isIdentityState(state)) {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  return NextResponse.json({ state }, {
    headers: { "Cache-Control": "no-store" },
  });
}
