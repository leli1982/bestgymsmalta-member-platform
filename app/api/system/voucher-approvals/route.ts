import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    if (request.nextUrl.searchParams.get("countOnly") === "1") {
      const countResult = await db.from("bgm_voucher_approval_requests")
        .select("id",{count:"exact",head:true}).eq("status","pending");
      if (countResult.error) throw countResult.error;
      return NextResponse.json({pendingCount:countResult.count || 0},{headers:noStore});
    }

    const result = await db.from("bgm_voucher_approval_requests")
      .select("id,application_id,voucher_code,gym_id,status,requested_by_system_user_id,requested_at,reviewed_by_system_user_id,reviewed_at,decision_note")
      .order("requested_at",{ascending:false}).limit(120);
    if (result.error) throw result.error;
    const records = result.data || [];
    const applicationIds = Array.from(new Set(records.map(r => r.application_id)));
    const gymIds = Array.from(new Set(records.map(r => r.gym_id)));
    const userIds = Array.from(new Set(records.flatMap(r => [r.requested_by_system_user_id,r.reviewed_by_system_user_id]).filter((id): id is string => Boolean(id))));

    const [applications,members,gyms,users] = await Promise.all([
      applicationIds.length ? db.from("bgm_membership_applications")
        .select("id,application_reference,status,application_kind")
        .in("id",applicationIds) : Promise.resolve({data:[],error:null}),
      applicationIds.length ? db.from("bgm_membership_application_members")
        .select("application_id,first_name,last_name,participant_order")
        .in("application_id",applicationIds).eq("participant_order",1) : Promise.resolve({data:[],error:null}),
      gymIds.length ? db.from("bgm_gyms")
        .select("id,name").in("id",gymIds) : Promise.resolve({data:[],error:null}),
      userIds.length ? db.from("bgm_system_users")
        .select("id,display_name").in("id",userIds) : Promise.resolve({data:[],error:null}),
    ]);
    for (const query of [applications,members,gyms,users]) if (query.error) throw query.error;
    const byApplication = new Map((applications.data || []).map(a => [a.id,a]));
    const byMember = new Map((members.data || []).map(m => [m.application_id,m]));
    const byGym = new Map((gyms.data || []).map(g => [g.id,g.name]));
    const byUser = new Map((users.data || []).map(u => [u.id,u.display_name]));
    const rows = records.map(row => ({
      id:row.id,applicationId:row.application_id,
      reference:byApplication.get(row.application_id)?.application_reference || row.application_id,
      applicationStatus:byApplication.get(row.application_id)?.status || "unknown",
      applicationKind:byApplication.get(row.application_id)?.application_kind || "unknown",
      memberName:[byMember.get(row.application_id)?.first_name,byMember.get(row.application_id)?.last_name].filter(Boolean).join(" ") || "Member",
      voucherCode:row.voucher_code,
      gymName:byGym.get(row.gym_id) || row.gym_id,
      status:row.status,
      requestedBy:byUser.get(row.requested_by_system_user_id) || "Staff",
      requestedAt:row.requested_at,
      reviewedBy:row.reviewed_by_system_user_id ? byUser.get(row.reviewed_by_system_user_id) || "Super Admin" : null,
      reviewedAt:row.reviewed_at,
      note:row.decision_note,
    }));
    // Pending actions first; history below. Closed applications cannot be approved.
    rows.sort((a,b) => Number(b.status === "pending" && b.applicationStatus !== "activated") -
      Number(a.status === "pending" && a.applicationStatus !== "activated") ||
      b.requestedAt.localeCompare(a.requestedAt));
    return NextResponse.json({pendingCount:rows.filter(r=>r.status==="pending" && r.applicationStatus!=="activated").length,requests:rows},{headers:noStore});
  } catch (error) {
    console.error("Could not load voucher approvals.",error);
    return NextResponse.json({error:"Could not load voucher approvals."},{status:500,headers:noStore});
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json().catch(() => ({}));
    const requestId = String(body.requestId || "");
    const decision = String(body.decision || "").toLowerCase();
    const note = String(body.note || "").trim().slice(0,500);
    if (!UUID.test(requestId) || !["approved","rejected"].includes(decision)) {
      return NextResponse.json({error:"Invalid voucher approval decision."},{status:400,headers:noStore});
    }
    const result = await getSupabaseAdmin().rpc("bgm_decide_voucher_approval",{
      p_request_id:requestId,
      p_decision:decision,
      p_system_user_id:auth.context.systemUserId,
      p_note:note || null,
    });
    if (result.error) return NextResponse.json({error:result.error.message},{status:409,headers:noStore});
    return NextResponse.json({ok:true,decision:result.data},{headers:noStore});
  } catch (error) {
    console.error("Could not decide voucher approval.",error);
    return NextResponse.json({error:"Could not decide voucher approval."},{status:500,headers:noStore});
  }
}
