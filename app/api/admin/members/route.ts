import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest) {
  const expectedPin = process.env.BGM_ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");

  return Boolean(expectedPin && suppliedPin && suppliedPin === expectedPin);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function publicMember(member: any) {
  return {
    id: member.id,
    memberNumber: member.member_number,
    fullName: member.full_name || "",
    email: member.email || "",
    phone: member.phone || "",
    status: member.status || "active",
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

      const payload = {
        member_number: clean(member.memberNumber).toUpperCase(),
        full_name: clean(member.fullName),
        email: clean(member.email).toLowerCase(),
        phone: clean(member.phone) || null,
        status: clean(member.status) || "active",
        membership_expiry: clean(member.membershipExpiry) || null,
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
