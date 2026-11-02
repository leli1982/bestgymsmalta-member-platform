import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const FEED_LIMIT = 80;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function titleCase(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMembershipAction(row: any) {
  const action = clean(row.action_key).toLowerCase();
  const entity = clean(row.entity_type).toLowerCase();
  return action.includes("membership") || entity.includes("membership") || entity === "member";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const db = getSupabaseAdmin();
    const businessDate = todayMaltaDate();
    const gymId = clean(request.nextUrl.searchParams.get("gymId"));

    const gymsResult = await db
      .from("bgm_gyms")
      .select("id,name,short_name,status")
      .order("name", { ascending: true });
    if (gymsResult.error) throw gymsResult.error;

    const gyms = (gymsResult.data || []).map((gym) => ({
      id: gym.id,
      name: gym.name || gym.short_name || gym.id,
      status: gym.status || "active",
    }));

    if (!gymId) {
      return NextResponse.json({ gyms, businessDate, summary: null, feed: [], generatedAt: new Date().toISOString() }, { headers: noStore });
    }

    const gym = gyms.find((item) => item.id === gymId);
    if (!gym) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404, headers: noStore });
    }

    const { start, end } = maltaDayUtcRange(businessDate);
    const [scansResult, checkinsResult, auditResult, barResult] = await Promise.all([
      db.from("bgm_access_scans")
        .select("id,member_id,gym_id,result,scanned_at,credential_type,photo_required_warning")
        .eq("gym_id", gymId)
        .gte("scanned_at", start)
        .lt("scanned_at", end)
        .order("scanned_at", { ascending: false })
        .limit(150),
      db.from("bgm_member_checkins")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gymId)
        .gte("checkin_at", start)
        .lt("checkin_at", end),
      db.from("bgm_audit_trail_read")
        .select("id,created_at,system_username,system_display_name,staff_name,action_key,entity_type,member_number,member_name,category")
        .eq("context_gym_id", gymId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(150),
      db.from("bgm_operational_orders")
        .select("id,staff_name,status,total_cents,submitted_at,business_date")
        .eq("order_type", "bar")
        .eq("gym_id", gymId)
        .eq("business_date", businessDate)
        .neq("status", "cancelled")
        .order("submitted_at", { ascending: false })
        .limit(100),
    ]);

    if (scansResult.error) throw scansResult.error;
    if (checkinsResult.error) throw checkinsResult.error;
    if (auditResult.error) throw auditResult.error;
    if (barResult.error) throw barResult.error;

    const scans = scansResult.data || [];
    const audits = auditResult.data || [];
    const barOrders = barResult.data || [];
    const memberIds = Array.from(new Set(scans.map((row) => row.member_id).filter(Boolean)));
    const membersResult = memberIds.length
      ? await db.from("bgm_members").select("id,member_number,full_name").in("id", memberIds)
      : { data: [], error: null };
    if (membersResult.error) throw membersResult.error;

    const memberById = new Map((membersResult.data || []).map((member: any) => [String(member.id), member]));
    const rejectedScans = scans.filter((row) => clean(row.result).toLowerCase() !== "granted");
    const acceptedScans = scans.length - rejectedScans.length;
    const membershipActions = audits.filter(isMembershipAction).length;
    const barTotalCents = barOrders.reduce((sum, row) => sum + (Number(row.total_cents) || 0), 0);

    const scanFeed = scans.map((row) => {
      const granted = clean(row.result).toLowerCase() === "granted";
      const member = row.member_id ? memberById.get(String(row.member_id)) : null;
      const identity = member
        ? [member.member_number, member.full_name].filter(Boolean).join(" — ")
        : "Unknown / unmatched member";
      return {
        id: `scan:${row.id}`,
        at: row.scanned_at,
        kind: "scan",
        tone: granted ? "success" : "warning",
        title: granted ? "Access granted" : `Access rejected — ${titleCase(clean(row.result) || "Unknown")}`,
        detail: `${identity}${row.credential_type ? ` • ${String(row.credential_type).toUpperCase()}` : ""}${row.photo_required_warning ? " • Photo warning" : ""}`,
      };
    });

    const auditFeed = audits.map((row) => {
      const actor = clean(row.staff_name) || clean(row.system_display_name) || clean(row.system_username) || "Staff";
      const member = [clean(row.member_number), clean(row.member_name)].filter(Boolean).join(" — ");
      return {
        id: `audit:${row.id}`,
        at: row.created_at,
        kind: "activity",
        tone: row.category === "financial" ? "financial" : "info",
        title: titleCase(clean(row.action_key) || "System activity"),
        detail: [actor, member].filter(Boolean).join(" • "),
      };
    });

    const feed = [...scanFeed, ...auditFeed]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, FEED_LIMIT);

    return NextResponse.json({
      gyms,
      gym,
      businessDate,
      summary: {
        checkIns: checkinsResult.count || 0,
        acceptedScans,
        rejectedScans: rejectedScans.length,
        membershipActions,
        barSubmissions: barOrders.length,
        barTotalCents,
        auditActions: audits.length,
      },
      feed,
      generatedAt: new Date().toISOString(),
    }, { headers: noStore });
  } catch (error) {
    console.error("Live gym monitor failed:", error);
    return NextResponse.json({ error: "Could not load live gym activity." }, { status: 500, headers: noStore });
  }
}
