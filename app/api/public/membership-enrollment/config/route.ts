import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getEnrollmentReadiness } from "@/lib/membershipEnrollmentReadiness";
import {
  validatePriceMatrix,
  type MembershipDurationKey,
  type MembershipType,
} from "@/lib/membershipSettingsCore";
import type {
  PublicEnrollmentConfig,
  PublishedDeclarationSnapshot,
} from "@/lib/membershipRegistrationTypes";

const PUBLIC_DECLARATION_KEYS = ["gym_rules", "privacy", "health", "guardian"] as const;

function cleanGymSlug(value: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function declarationSnapshot(row: {
  id: string;
  content_key: string;
  version_no: number;
  body: string;
  content_sha256: string;
}): PublishedDeclarationSnapshot {
  return {
    id: row.id,
    contentKey: row.content_key as PublishedDeclarationSnapshot["contentKey"],
    versionNo: Number(row.version_no),
    body: row.body,
    contentSha256: row.content_sha256,
  };
}

function notReady() {
  return NextResponse.json({ error: "Enrollment is not ready." }, { status: 503 });
}

export async function GET(request: NextRequest) {
  const gymSlug = cleanGymSlug(request.nextUrl.searchParams.get("gymSlug"));
  if (!gymSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymSlug)) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const { data: gym, error: gymError } = await supabase
    .from("bgm_gyms")
    .select("id,name,short_name,public_enrollment_slug,status")
    .eq("public_enrollment_slug", gymSlug)
    .eq("status", "active")
    .maybeSingle();

  if (gymError) {
    console.error("Public enrollment gym lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (!gym) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  const { data: catalog, error: catalogError } = await supabase
    .from("bgm_membership_price_catalog_versions")
    .select("id,version_no,status")
    .eq("status", "published")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (catalogError) {
    console.error("Public enrollment price catalog lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (!catalog) return notReady();

  const [{ data: priceRows, error: priceError }, { data: declarationRows, error: declarationError }] =
    await Promise.all([
      supabase
        .from("bgm_membership_price_entries")
        .select("membership_type,duration_key,amount_cents,currency")
        .eq("catalog_version_id", catalog.id),
      supabase
        .from("bgm_membership_declaration_versions")
        .select("id,content_key,version_no,body,content_sha256,status")
        .eq("status", "published")
        .in("content_key", [...PUBLIC_DECLARATION_KEYS]),
    ]);

  if (priceError || declarationError) {
    console.error("Public enrollment settings lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const entries = (priceRows || []).map((row) => ({
    membershipType: row.membership_type as MembershipType,
    durationKey: row.duration_key as MembershipDurationKey,
    amountCents: Number(row.amount_cents),
    currency: "EUR" as const,
  }));

  try {
    validatePriceMatrix(entries);
  } catch {
    return notReady();
  }

  const publishedDeclarations = new Set((declarationRows || []).map((row) => row.content_key));
  const readiness = getEnrollmentReadiness(publishedDeclarations);
  if (!readiness.ready) return notReady();

  const byKey = new Map((declarationRows || []).map((row) => [row.content_key, row]));
  const gymRules = byKey.get("gym_rules");
  const privacy = byKey.get("privacy");
  const health = byKey.get("health");
  const guardian = byKey.get("guardian");
  if (!gymRules || !privacy || !health) return notReady();

  const response: PublicEnrollmentConfig = {
    gym: {
      id: gym.id,
      name: gym.name,
      shortName: gym.short_name || gym.name,
      slug: gym.public_enrollment_slug,
    },
    pricing: {
      versionId: catalog.id,
      entries,
    },
    declarations: {
      gymRules: declarationSnapshot(gymRules),
      privacy: declarationSnapshot(privacy),
      health: declarationSnapshot(health),
      ...(guardian ? { guardian: declarationSnapshot(guardian) } : {}),
    },
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
