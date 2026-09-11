import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  normalizeMembershipNumber,
  parseMembershipNumber,
} from "@/lib/memberNumberCore";

export const dynamic = "force-dynamic";

const MEMBER_SEARCH_FIELDS =
  "id, member_number, first_name, last_name, full_name, status, membership_expiry, mobile, phone, email, legacy_pk_customer, legacy_gym, official_photo_path";

function escapeLikePattern(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function toCandidate(member: any, canViewOfficialPhoto: boolean) {
  return {
    id: member.id,
    memberNumber: member.member_number || "",
    firstName: member.first_name || "",
    lastName: member.last_name || "",
    fullName: member.full_name || "",
    status: member.status || "inactive",
    membershipExpiry: member.membership_expiry || "",
    mobile: member.mobile || member.phone || "",
    email: member.email || "",
    legacyPkCustomer: member.legacy_pk_customer || "",
    legacyGym: member.legacy_gym || "",
    officialPhotoPath: canViewOfficialPhoto
      ? member.official_photo_path || null
      : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireSystemPermission(request, "members.view");
  if (auth.error) return auth.error;

  const query = String(request.nextUrl.searchParams.get("q") || "").trim();
  if (query.length < 2) {
    return NextResponse.json(
      { error: "Enter at least 2 characters or scan a membership barcode." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const normalizedMemberNumber = normalizeMembershipNumber(query);
  const canViewOfficialPhoto =
    auth.context.isSuperAdmin ||
    auth.context.permissions.includes("members.photos.view");

  if (parseMembershipNumber(normalizedMemberNumber) !== null) {
    const result = await supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .eq("member_number", normalizedMemberNumber)
      .limit(1);

    if (result.error) {
      console.error(result.error);
      return NextResponse.json(
        { error: "Could not search members." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      candidates: (result.data || []).map((member) =>
        toCandidate(member, canViewOfficialPhoto)
      ),
      exactMembershipNumber: true,
    });
  }

  const pattern = `%${escapeLikePattern(query)}%`;

  const [nameResult, mobileResult, phoneResult, emailResult, legacyPkResult] =
    await Promise.all([
      supabase.from("bgm_members").select(MEMBER_SEARCH_FIELDS).ilike("full_name", pattern).limit(12),
      supabase.from("bgm_members").select(MEMBER_SEARCH_FIELDS).ilike("mobile", pattern).limit(12),
      supabase.from("bgm_members").select(MEMBER_SEARCH_FIELDS).ilike("phone", pattern).limit(12),
      supabase.from("bgm_members").select(MEMBER_SEARCH_FIELDS).ilike("email", pattern).limit(12),
      supabase.from("bgm_members").select(MEMBER_SEARCH_FIELDS).eq("legacy_pk_customer", query).limit(20),
    ]);

  const results = [nameResult, mobileResult, phoneResult, emailResult, legacyPkResult];
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error(failed.error);
    return NextResponse.json({ error: "Could not search members." }, { status: 500 });
  }

  const uniqueCandidates = new Map<string, any>();
  for (const result of results) {
    for (const member of result.data || []) {
      if (!uniqueCandidates.has(member.id)) uniqueCandidates.set(member.id, member);
    }
  }

  return NextResponse.json({
    candidates: Array.from(uniqueCandidates.values())
      .slice(0, 20)
      .map((member) => toCandidate(member, canViewOfficialPhoto)),
    exactMembershipNumber: false,
  });
}
