import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  normalizeMembershipNumber,
  parseMembershipNumber,
} from "@/lib/memberNumberCore";
import {
  classifyStaffMember,
  matchesStaffMemberFilter,
  type StaffMemberFilter,
} from "@/lib/staffDashboardCore";

export const dynamic = "force-dynamic";

const MEMBER_SEARCH_FIELDS =
  "id, member_number, first_name, last_name, full_name, status, membership_expiry, mobile, phone, email, id_number, enrollment_gym_id, legacy_pk_customer, legacy_gym, official_photo_path";
const VALID_FILTERS = new Set<StaffMemberFilter>(["all", "active", "expired"]);

function escapeLikePattern(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toCandidate(
  member: any,
  canViewOfficialPhoto: boolean,
  today: string
) {
  const classification = classifyStaffMember({
    status: member.status,
    membershipExpiry: member.membership_expiry,
    today,
  });
  const hasOfficialPhoto = Boolean(member.official_photo_path);

  return {
    id: member.id,
    memberNumber: member.member_number || "",
    firstName: member.first_name || "",
    lastName: member.last_name || "",
    fullName: member.full_name || "",
    status: member.status || "inactive",
    classification,
    membershipExpiry: member.membership_expiry || "",
    mobile: member.mobile || member.phone || "",
    email: member.email || "",
    idNumber: member.id_number || "",
    enrollmentGymId: member.enrollment_gym_id || null,
    legacyPkCustomer: member.legacy_pk_customer || "",
    legacyGym: member.legacy_gym || "",
    officialPhotoPath: canViewOfficialPhoto
      ? member.official_photo_path || null
      : null,
    photoUrl:
      canViewOfficialPhoto && hasOfficialPhoto
        ? `/api/system/members/photo/${encodeURIComponent(member.id)}`
        : null,
  };
}

function sortMembersByName(left: any, right: any) {
  return String(left.full_name || "").localeCompare(String(right.full_name || ""), "en", {
    sensitivity: "base",
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireSystemPermission(request, "members.view");
  if (auth.error || !auth.context) return auth.error;

  const query = String(request.nextUrl.searchParams.get("q") || "").trim();
  const requestedStatus = String(
    request.nextUrl.searchParams.get("status") || "all"
  ).toLowerCase() as StaffMemberFilter;
  const page = positiveInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = Math.min(
    positiveInteger(request.nextUrl.searchParams.get("limit"), 30),
    50
  );

  if (!VALID_FILTERS.has(requestedStatus)) {
    return NextResponse.json(
      { error: "Status filter must be all, active or expired." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const canViewOfficialPhoto =
    auth.context.isSuperAdmin ||
    auth.context.permissions.includes("members.photos.view");

  if (!query) {
    const offset = (page - 1) * limit;

    if (requestedStatus === "active") {
      const poolSize = page * limit;
      const [noExpiryResult, currentExpiryResult] = await Promise.all([
        supabase
          .from("bgm_members")
          .select(MEMBER_SEARCH_FIELDS)
          .eq("status", "active")
          .is("membership_expiry", null)
          .order("full_name", { ascending: true })
          .limit(poolSize),
        supabase
          .from("bgm_members")
          .select(MEMBER_SEARCH_FIELDS)
          .eq("status", "active")
          .gte("membership_expiry", today)
          .order("full_name", { ascending: true })
          .limit(poolSize),
      ]);

      if (noExpiryResult.error || currentExpiryResult.error) {
        console.error(noExpiryResult.error || currentExpiryResult.error);
        return NextResponse.json(
          { error: "Could not browse members." },
          { status: 500 }
        );
      }

      const unique = new Map<string, any>();
      for (const member of [
        ...(noExpiryResult.data || []),
        ...(currentExpiryResult.data || []),
      ]) {
        if (!unique.has(member.id)) unique.set(member.id, member);
      }

      const members = Array.from(unique.values())
        .sort(sortMembersByName)
        .slice(offset, offset + limit);

      return NextResponse.json({
        candidates: members.map((member) =>
          toCandidate(member, canViewOfficialPhoto, today)
        ),
        exactMembershipNumber: false,
        page,
        limit,
        filter: requestedStatus,
        hasMore: members.length === limit,
      });
    }

    let browseQuery = supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .order("full_name", { ascending: true });

    if (requestedStatus === "expired") {
      browseQuery = browseQuery
        .eq("status", "active")
        .lt("membership_expiry", today);
    }

    const browseResult = await browseQuery.range(offset, offset + limit - 1);
    if (browseResult.error) {
      console.error(browseResult.error);
      return NextResponse.json(
        { error: "Could not browse members." },
        { status: 500 }
      );
    }

    const candidates = (browseResult.data || [])
      .map((member) => toCandidate(member, canViewOfficialPhoto, today))
      .filter((candidate) =>
        matchesStaffMemberFilter(candidate.classification, requestedStatus)
      );

    return NextResponse.json({
      candidates,
      exactMembershipNumber: false,
      page,
      limit,
      filter: requestedStatus,
      hasMore: (browseResult.data || []).length === limit,
    });
  }

  const normalizedMemberNumber = normalizeMembershipNumber(query);
  const exactMemberNumber =
    parseMembershipNumber(normalizedMemberNumber) !== null
      ? normalizedMemberNumber
      : query;
  const exactResult = await supabase
    .from("bgm_members")
    .select(MEMBER_SEARCH_FIELDS)
    .eq("member_number", exactMemberNumber)
    .limit(1);

  if (exactResult.error) {
    console.error(exactResult.error);
    return NextResponse.json(
      { error: "Could not search members." },
      { status: 500 }
    );
  }

  if ((exactResult.data || []).length > 0) {
    const candidates = (exactResult.data || [])
      .map((member) => toCandidate(member, canViewOfficialPhoto, today))
      .filter((candidate) =>
        matchesStaffMemberFilter(candidate.classification, requestedStatus)
      );

    return NextResponse.json({
      candidates,
      exactMembershipNumber: true,
      page: 1,
      limit,
      filter: requestedStatus,
      hasMore: false,
    });
  }

  const pattern = `%${escapeLikePattern(query)}%`;
  const searchPoolLimit = Math.min(200, Math.max(50, page * limit * 2));

  const [
    memberNumberResult,
    nameResult,
    idNumberResult,
    mobileResult,
    phoneResult,
    emailResult,
    legacyPkResult,
  ] = await Promise.all([
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .ilike("member_number", pattern)
      .limit(searchPoolLimit),
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .ilike("full_name", pattern)
      .limit(searchPoolLimit),
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .ilike("id_number", pattern)
      .limit(searchPoolLimit),
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .ilike("mobile", pattern)
      .limit(searchPoolLimit),
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .ilike("phone", pattern)
      .limit(searchPoolLimit),
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .ilike("email", pattern)
      .limit(searchPoolLimit),
    supabase
      .from("bgm_members")
      .select(MEMBER_SEARCH_FIELDS)
      .eq("legacy_pk_customer", query)
      .limit(searchPoolLimit),
  ]);

  const results = [
    memberNumberResult,
    nameResult,
    idNumberResult,
    mobileResult,
    phoneResult,
    emailResult,
    legacyPkResult,
  ];
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error(failed.error);
    return NextResponse.json(
      { error: "Could not search members." },
      { status: 500 }
    );
  }

  const uniqueCandidates = new Map<string, any>();
  for (const result of results) {
    for (const member of result.data || []) {
      if (!uniqueCandidates.has(member.id)) uniqueCandidates.set(member.id, member);
    }
  }

  const filteredCandidates = Array.from(uniqueCandidates.values())
    .sort(sortMembersByName)
    .map((member) => toCandidate(member, canViewOfficialPhoto, today))
    .filter((candidate) =>
      matchesStaffMemberFilter(candidate.classification, requestedStatus)
    );
  const offset = (page - 1) * limit;
  const candidates = filteredCandidates.slice(offset, offset + limit);

  return NextResponse.json({
    candidates,
    exactMembershipNumber: false,
    page,
    limit,
    filter: requestedStatus,
    hasMore: filteredCandidates.length > offset + limit,
  });
}
