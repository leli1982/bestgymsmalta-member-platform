import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function formatDateForCsv(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return text;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export async function GET(request: NextRequest) {
  try {
    const adminError = requireAdmin(request);
    if (adminError) return adminError;

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_members")
      .select(
        "member_number, full_name, email, phone, status, enrollment_date, membership_period, membership_expiry, app_enrolled, username, notes, created_at, updated_at"
      )
      .order("member_number", { ascending: true });

    if (result.error) throw result.error;

    const headers = [
      "memberNumber",
      "fullName",
      "email",
      "phone",
      "status",
      "enrollmentDate",
      "membershipPeriod",
      "membershipExpiry",
      "appEnrolled",
      "username",
      "notes",
      "createdAt",
      "updatedAt",
    ];

    const rows = (result.data || []).map((member) => [
      member.member_number,
      member.full_name,
      member.email,
      member.phone,
      member.status,
      formatDateForCsv(member.enrollment_date),
      member.membership_period,
      formatDateForCsv(member.membership_expiry),
      member.app_enrolled ? "yes" : "no",
      member.username,
      member.notes,
      member.created_at,
      member.updated_at,
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const filename = `bgm-members-export-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not export members." },
      { status: 500 }
    );
  }
}
