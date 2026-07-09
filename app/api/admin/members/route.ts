import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest) {
  return requireAdmin(request) === null;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function calculateStatus(status: string, expiry?: string | null) {
  if (status === "inactive") return "inactive";

  if (expiry) {
    const today = new Date().toISOString().slice(0, 10);
    if (expiry < today) return "inactive";
  }

  return "active";
}

function publicMember(member: any) {
  const status = calculateStatus(member.status || "active", member.membership_expiry);

  return {
    id: member.id,
    memberNumber: member.member_number,
    fullName: member.full_name || "",
    email: member.email || "",
    phone: member.phone || "",
    status,
    enrollmentDate: member.enrollment_date || "",
    membershipPeriod: member.membership_period || "",
    membershipExpiry: member.membership_expiry || "",
    notes: member.notes || "",
    username: member.username || "",
    appEnrolled: Boolean(member.app_enrolled),
    tempPasswordMustChange: Boolean(member.temp_password_must_change),
    createdAt: member.created_at,
    updatedAt: member.updated_at,
    lastLoginAt: member.last_login_at,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;

    return NextResponse.json({
      members: (result.data || []).map(publicMember),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not load members." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const mode = String(body.mode || "");

    if (mode === "create" || mode === "update") {
      const member = body.member || {};
      const id = clean(member.id);

      const membershipExpiry = clean(member.membershipExpiry) || null;
      const incomingStatus = clean(member.status) || "active";

      const payload = {
        member_number: clean(member.memberNumber).toUpperCase(),
        full_name: clean(member.fullName),
        email: clean(member.email).toLowerCase(),
        phone: clean(member.phone) || null,
        status: calculateStatus(incomingStatus, membershipExpiry),
        enrollment_date: clean(member.enrollmentDate) || null,
        membership_period: clean(member.membershipPeriod) || null,
        membership_expiry: membershipExpiry,
        notes: clean(member.notes) || null,
        updated_at: new Date().toISOString(),
      };

      if (!payload.member_number) {
        return NextResponse.json(
          { error: "Member number is required." },
          { status: 400 }
        );
      }

      if (!payload.full_name) {
        return NextResponse.json(
          { error: "Full name is required." },
          { status: 400 }
        );
      }

      if (!payload.email) {
        return NextResponse.json(
          { error: "Email is required." },
          { status: 400 }
        );
      }

      if (mode === "create") {
        const result = await supabase
          .from("bgm_members")
          .insert(payload)
          .select("*")
          .single();

        if (result.error) throw result.error;

        return NextResponse.json({
          member: publicMember(result.data),
        });
      }

      if (!id) {
        return NextResponse.json(
          { error: "Missing member ID." },
          { status: 400 }
        );
      }

      const result = await supabase
        .from("bgm_members")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (result.error) throw result.error;

      return NextResponse.json({
        member: publicMember(result.data),
      });
    }

    if (mode === "reset_app_login") {
      const id = clean(body.id);

      if (!id) {
        return NextResponse.json(
          { error: "Missing member ID." },
          { status: 400 }
        );
      }

      const result = await supabase
        .from("bgm_members")
        .update({
          username: null,
          password_hash: null,
          app_enrolled: false,
          temp_password_must_change: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (result.error) throw result.error;

      return NextResponse.json({
        member: publicMember(result.data),
      });
    }

    if (mode === "delete") {
      const id = clean(body.id);

      if (!id) {
        return NextResponse.json(
          { error: "Missing member ID." },
          { status: 400 }
        );
      }

      const result = await supabase.from("bgm_members").delete().eq("id", id);

      if (result.error) throw result.error;

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error(error);

    const message =
      error?.code === "23505"
        ? "Member number or email already exists."
        : "Member admin action failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
