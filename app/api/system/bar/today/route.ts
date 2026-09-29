import { NextRequest, NextResponse } from "next/server";
import { requireSystemPermission } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "orders.bar.submit");
    if (auth.error || !auth.context) return auth.error;
    const gymId = auth.context.isSuperAdmin
      ? (request.nextUrl.searchParams.get("gymId") || auth.context.gymId || "").trim()
      : (auth.context.gymId || "");
    if (!gymId) {
      return NextResponse.json({ error: "Select a gym to view today's Bar total." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    if (auth.context.isSuperAdmin) {
      const gym = await supabase.from("bgm_gyms").select("id").eq("id", gymId).maybeSingle();
      if (gym.error) throw gym.error;
      if (!gym.data) return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }
    const date = todayMaltaDate();
    let offset = 0;
    let submittedCount = 0;
    let totalCents = 0;
    let unpricedCount = 0;
    while (true) {
      const result = await supabase.from("bgm_operational_orders")
        .select("total_cents")
        .eq("order_type", "bar")
        .eq("gym_id", gymId)
        .eq("business_date", date)
        .neq("status", "cancelled")
        .range(offset, offset + 499);
      if (result.error) throw result.error;
      const rows = result.data || [];
      for (const order of rows) {
        submittedCount++;
        if (order.total_cents === null) unpricedCount++;
        else totalCents += Number(order.total_cents);
      }
      if (rows.length < 500) break;
      offset += 500;
    }
    return NextResponse.json(
      { gymId, businessDate: date, totalCents, submittedCount, unpricedCount },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Daily Bar total failed", error);
    return NextResponse.json({ error: "Could not load today's Bar total." }, { status: 500 });
  }
}
