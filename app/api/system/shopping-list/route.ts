import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pendingStatuses = ["submitted", "ordered"] as const;
const batchSize = 200;
const itemBatchSize = 500;

// Unlike the date-filtered Operations history, this includes ALL open Sundries
// requests, including older outstanding requests and gym locations now inactive.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const supabase = getSupabaseAdmin();
    const orders: Array<{
      id: string; gym_id: string; staff_name: string; status: string;
      notes: string | null; submitted_at: string;
      items?: Array<{ id: string; item_name: string; quantity: number; unit: string | null; notes: string | null }>;
      gym_name?: string;
    }> = [];
    for (let offset = 0; ; offset += batchSize) {
      const result = await supabase.from("bgm_operational_orders")
        .select("id,gym_id,staff_name,status,notes,submitted_at")
        .eq("order_type", "sundries")
        .in("status", [...pendingStatuses])
        .order("submitted_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (result.error) throw result.error;
      const rows = result.data || [];
      orders.push(...rows);
      if (rows.length < batchSize) break;
    }

    const gymIds = [...new Set(orders.map((order) => order.gym_id))];
    const gyms = new Map<string, string>();
    for (let index = 0; index < gymIds.length; index += batchSize) {
      const result = await supabase.from("bgm_gyms")
        .select("id,name").in("id", gymIds.slice(index, index + batchSize));
      if (result.error) throw result.error;
      for (const gym of result.data || []) gyms.set(gym.id, gym.name);
    }

    for (let index = 0; index < orders.length; index += batchSize) {
      const batch = orders.slice(index, index + batchSize);
      const itemsByOrder = new Map<string, NonNullable<(typeof orders)[number]["items"]>>();
      for (let offset = 0; ; offset += itemBatchSize) {
        const result = await supabase.from("bgm_operational_order_items")
          .select("id,order_id,item_name,quantity,unit,notes,sort_order")
          .in("order_id", batch.map((order) => order.id))
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + itemBatchSize - 1);
        if (result.error) throw result.error;
        const rows = result.data || [];
        for (const item of rows) {
          const list = itemsByOrder.get(item.order_id) || [];
          list.push({ id: item.id, item_name: item.item_name, quantity: Number(item.quantity), unit: item.unit, notes: item.notes });
          itemsByOrder.set(item.order_id, list);
        }
        if (rows.length < itemBatchSize) break;
      }
      for (const order of batch) {
        order.items = itemsByOrder.get(order.id) || [];
        order.gym_name = gyms.get(order.gym_id) || order.gym_id;
      }
    }

    return NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load the Super Admin Shopping List:", error);
    return NextResponse.json({ error: "Could not load the Shopping List." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return NextResponse.json({ error: "Select a valid Sundries request." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const current = await supabase.from("bgm_operational_orders")
      .select("id,gym_id,status,order_type")
      .eq("id", orderId).maybeSingle();
    if (current.error) throw current.error;
    const existing = current.data;
    if (!existing || existing.order_type !== "sundries") {
      return NextResponse.json({ error: "Sundries request not found." }, { status: 404 });
    }
    if (!pendingStatuses.some((status) => status === existing.status)) {
      return NextResponse.json({ error: "This request is no longer outstanding. Refresh the Shopping List." }, { status: 409 });
    }

    const now = new Date().toISOString();
    // Guard against concurrent clicks/status changes: never re-complete a
    // cancelled or already-delivered order after a stale screen is used.
    const updated = await supabase.from("bgm_operational_orders").update({
      status: "completed",
      completed_at: now,
      status_updated_by_system_user_id: auth.context.systemUserId,
      status_staff_name: auth.context.displayName,
      updated_at: now,
    }).eq("id", orderId).eq("order_type", "sundries")
      .eq("status", existing.status)
      .select("id,status,gym_id,completed_at").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) {
      return NextResponse.json({ error: "This request changed while you were viewing it. Refresh the Shopping List." }, { status: 409 });
    }
    const audit = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: existing.gym_id,
      staff_name: auth.context.displayName,
      action_key: "orders.delivered",
      entity_type: "operational_order",
      entity_id: orderId,
      before_data: { status: existing.status },
      after_data: { status: "completed", deliveredAt: now, source: "shopping_list" },
    });
    if (audit.error) console.error("Could not record Shopping List delivery audit:", audit.error);
    return NextResponse.json({ order: updated.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not mark Sundries request delivered:", error);
    return NextResponse.json({ error: "Could not mark request delivered." }, { status: 500 });
  }
}
