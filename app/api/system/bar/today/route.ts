import { NextRequest, NextResponse } from "next/server";
import { snapshotBarSale, type BarCatalogItem } from "@/lib/barSalesCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveGym(request: NextRequest, bodyGymId?: unknown) {
  const auth = await requireSystemPermission(request, "orders.bar.submit");
  if (auth.error || !auth.context) return { response: auth.error, context: null, gymId: "" };
  const gymId = auth.context.isSuperAdmin
    ? clean(bodyGymId || request.nextUrl.searchParams.get("gymId") || auth.context.gymId)
    : clean(auth.context.gymId);
  if (!gymId) return { response: jsonError("Select a gym to view the daily Bar sheet.", 400), context: null, gymId: "" };

  if (auth.context.isSuperAdmin) {
    const gym = await getSupabaseAdmin().from("bgm_gyms").select("id").eq("id", gymId).maybeSingle();
    if (gym.error) throw gym.error;
    if (!gym.data) return { response: jsonError("Gym not found.", 404), context: null, gymId: "" };
  }
  return { response: null, context: auth.context, gymId };
}

async function loadSheet(gymId: string) {
  const supabase = getSupabaseAdmin();
  const businessDate = todayMaltaDate();
  const orderResult = await supabase.from("bgm_operational_orders")
    .select("id,total_cents,cash_found_cents,locked_at,updated_at")
    .eq("order_type", "bar")
    .eq("is_daily_sheet", true)
    .eq("gym_id", gymId)
    .eq("business_date", businessDate)
    .maybeSingle();
  if (orderResult.error) throw orderResult.error;

  let items: any[] = [];
  if (orderResult.data?.id) {
    const itemsResult = await supabase.from("bgm_operational_order_items")
      .select("id,catalog_item_id,item_name,quantity,unit_price_cents,line_total_cents,sort_order")
      .eq("order_id", orderResult.data.id)
      .order("sort_order", { ascending: true });
    if (itemsResult.error) throw itemsResult.error;
    items = (itemsResult.data || []).map((row) => ({
      id: row.id,
      catalogItemId: row.catalog_item_id,
      itemName: row.item_name,
      quantity: Number(row.quantity || 0),
      unitPriceCents: Number(row.unit_price_cents || 0),
      lineTotalCents: Number(row.line_total_cents || 0),
      sortOrder: Number(row.sort_order || 0),
    }));
  }

  return {
    gymId,
    businessDate,
    orderId: orderResult.data?.id || null,
    totalCents: Number(orderResult.data?.total_cents || 0),
    locked: Boolean(orderResult.data?.locked_at),
    lockedAt: orderResult.data?.locked_at || null,
    updatedAt: orderResult.data?.updated_at || null,
    items,
  };
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveGym(request);
    if (resolved.response || !resolved.context) return resolved.response!;
    const sheet = await loadSheet(resolved.gymId);
    return NextResponse.json(sheet, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Daily Bar sheet read failed", error);
    return jsonError("Could not load today's Bar sheet.", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const resolved = await resolveGym(request, body.gymId);
    if (resolved.response || !resolved.context) return resolved.response!;
    const { context, gymId } = resolved;
    const supabase = getSupabaseAdmin();
    const businessDate = todayMaltaDate();

    if (!Array.isArray(body.barEntries)) return jsonError("A valid daily Bar sheet is required.", 400);

    const catalogResult = await supabase.from("bgm_bar_catalog_items")
      .select("id,name,price_cents,is_other,active,sort_order,updated_at")
      .eq("active", true);
    if (catalogResult.error) throw catalogResult.error;
    const catalog: BarCatalogItem[] = (catalogResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      isOther: row.is_other,
      active: row.active,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
    }));

    let items: Array<{
      catalogItemId: string;
      itemName: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }> = [];
    if (body.barEntries.length) {
      const snapshot = snapshotBarSale(body.barEntries, catalog);
      if (snapshot.error) return jsonError(snapshot.error, 409);
      items = snapshot.items.map((item) => ({
        catalogItemId: item.catalogItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
      }));
    }

    const saveResult = await supabase.rpc("bgm_save_daily_bar_sheet", {
      p_gym_id: gymId,
      p_system_user_id: context.systemUserId,
      p_staff_name: context.displayName || context.username || "Staff",
      p_business_date: businessDate,
      p_cash_found_cents: null,
      p_items: items,
    });
    if (saveResult.error) {
      const message = String(saveResult.error.message || "");
      if (/End of Day has already been submitted|locked by End of Day/i.test(message)) {
        return NextResponse.json({ error: message, locked: true }, { status: 409 });
      }
      if (/invalid|required|incomplete/i.test(message)) return jsonError(message, 400);
      throw saveResult.error;
    }

    const sheet = await loadSheet(gymId);
    return NextResponse.json({ ok: true, sheet }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Daily Bar sheet save failed", error);
    return jsonError("Could not save today's Bar sheet.", 500);
  }
}
