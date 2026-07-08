import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function publicPlan(row: any) {
  if (!row) return null;

  return {
    id: row.id,
    memberId: row.member_id,
    goal: row.goal || "",
    level: row.level || "",
    daysPerWeek: row.days_per_week || 3,
    minutes: row.minutes || 45,
    style: row.style || "",
    limitations: row.limitations || "",
    plan: row.plan_json || {},
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  };
}

async function getActiveMember(memberId: string) {
  const supabase = getSupabaseAdmin();

  const result = await supabase
    .from("bgm_members")
    .select("id, status, membership_expiry")
    .eq("id", memberId)
    .maybeSingle();

  if (result.error) throw result.error;

  const member = result.data;

  if (!member) {
    return { ok: false, error: "Member account not found." };
  }

  if (member.status !== "active") {
    return {
      ok: false,
      error: "This membership is inactive. Please renew at reception.",
    };
  }

  if (member.membership_expiry && member.membership_expiry < todayString()) {
    return {
      ok: false,
      error: "This membership has expired. Please renew at reception.",
    };
  }

  return { ok: true, error: "" };
}

export async function GET(request: NextRequest) {
  try {
    const memberId = clean(request.nextUrl.searchParams.get("memberId"));

    if (!memberId) {
      return NextResponse.json({ savedPlan: null });
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_member_workout_plans")
      .select("*")
      .eq("member_id", memberId)
      .maybeSingle();

    if (result.error) throw result.error;

    return NextResponse.json({
      savedPlan: publicPlan(result.data),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { savedPlan: null, error: "Could not load saved workout plan." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const memberId = clean(body.memberId);
    const goal = clean(body.goal);
    const level = clean(body.level);
    const daysPerWeek = Number(body.daysPerWeek || 3);
    const minutes = Number(body.minutes || 45);
    const style = clean(body.style);
    const limitations = clean(body.limitations);
    const plan = body.plan || {};

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in before saving your plan." },
        { status: 401 }
      );
    }

    const activeMember = await getActiveMember(memberId);

    if (!activeMember.ok) {
      return NextResponse.json(
        { error: activeMember.error },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    const now = new Date().toISOString();

    const payload = {
      member_id: memberId,
      goal,
      level,
      days_per_week: daysPerWeek,
      minutes,
      style,
      limitations: limitations || null,
      plan_json: plan,
      saved_at: now,
      updated_at: now,
    };

    const result = await supabase
      .from("bgm_member_workout_plans")
      .upsert(payload, { onConflict: "member_id" })
      .select("*")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({
      savedPlan: publicPlan(result.data),
      message: "Workout plan saved to your member account.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not save workout plan." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const memberId = clean(request.nextUrl.searchParams.get("memberId"));

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_member_workout_plans")
      .delete()
      .eq("member_id", memberId);

    if (result.error) throw result.error;

    return NextResponse.json({
      ok: true,
      message: "Saved workout plan cleared.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not clear workout plan." },
      { status: 500 }
    );
  }
}
