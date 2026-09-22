import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, requireSystemPermission } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BAR_MAX_PRICE_CENTS } from "@/lib/barSalesCore";
import { BAR_STARTER_SHEET, BAR_STARTER_REVIEW_NOTES } from "@/lib/barStarterCatalog";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function mapItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    isOther: row.is_other,
    active: row.active,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function validPrice(price: unknown) {
  return typeof price === "number" && Number.isSafeInteger(price) &&
    price >= 0 && price <= BAR_MAX_PRICE_CENTS;
}

function cleanName(raw: unknown) {
  return typeof raw === "string" ? raw.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("starter") === "1") {
      const admin = await requireSuperAdmin(request);
      if (admin.error || !admin.context) return admin.error;
      return NextResponse.json(
        { items: BAR_STARTER_SHEET, reviewNotes: BAR_STARTER_REVIEW_NOTES },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const auth = await requireSystemPermission(request, "orders.bar.submit");
    if (auth.error || !auth.context) return auth.error;
    const supabase = getSupabaseAdmin();
    let query = supabase.from("bgm_bar_catalog_items")
      .select("id,name,price_cents,is_other,active,sort_order,updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!auth.context.isSuperAdmin) query = query.eq("active", true);
    const result = await query;
    if (result.error) throw result.error;
    return NextResponse.json(
      { items: (result.data || []).map(mapItem) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Bar catalogue read failed", error);
    return jsonError("Could not load the Bar catalogue.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    if (body.starterImport === true) {
      if (body.confirmation !== "PUBLISH_STARTER_BAR_CATALOG") {
        return jsonError("Review and explicitly confirm the starter list before publishing.", 400);
      }
      const supabase = getSupabaseAdmin();
      const existing = await supabase.from("bgm_bar_catalog_items")
        .select("id").limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) {
        return jsonError("The catalogue already contains products. The starter import never replaces an existing catalogue.", 409);
      }
      // One multi-row insert: constraint failures roll back the entire request.
      const rows = [
        ...BAR_STARTER_SHEET.map((item) => ({
          name: item.name, price_cents: item.priceCents,
          sort_order: item.sortOrder, is_other: false, active: true,
          updated_by_system_user_id: auth.context.systemUserId,
        })),
        {
          name: "Others", price_cents: null, sort_order: 9999,
          is_other: true, active: true,
          updated_by_system_user_id: auth.context.systemUserId,
        },
      ];
      const inserted = await supabase.from("bgm_bar_catalog_items")
        .insert(rows).select("id");
      if (inserted.error) {
        if (inserted.error.code === "23505") {
          return jsonError("The catalogue changed during import. Refresh and review it before trying again.", 409);
        }
        throw inserted.error;
      }
      return NextResponse.json(
        { importedCount: inserted.data?.length || 0 },
        { status: 201 },
      );
    }
    const isOther = body.isOther === true;
    const name = isOther ? "Others" : cleanName(body.name);
    if (!name || name.length > 120) return jsonError("Provide a product name (maximum 120 characters).", 400);
    const priceCents = isOther ? null : body.priceCents;
    if (!isOther && !validPrice(priceCents)) return jsonError("Provide a valid product unit price.", 400);
    const sortOrder = Number.isInteger(body.sortOrder) && Math.abs(body.sortOrder) <= 100000
      ? body.sortOrder : 0;
    const supabase = getSupabaseAdmin();
    const inserted = await supabase.from("bgm_bar_catalog_items").insert({
      name, price_cents: priceCents, is_other: isOther, sort_order: sortOrder,
      active: true, updated_by_system_user_id: auth.context.systemUserId,
    }).select("id,name,price_cents,is_other,active,sort_order,updated_at").single();
    if (inserted.error) {
      if (inserted.error.code === "23505") return jsonError("This product or Others field already exists.", 409);
      throw inserted.error;
    }
    return NextResponse.json({ item: mapItem(inserted.data) }, { status: 201 });
  } catch (error) {
    console.error("Bar catalogue create failed", error);
    return jsonError("Could not create this Bar item.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return jsonError("Select an existing Bar item.", 400);
    }
    const supabase = getSupabaseAdmin();
    const existing = await supabase.from("bgm_bar_catalog_items")
      .select("id,is_other").eq("id", body.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return jsonError("Bar item not found.", 404);
    const isOther = Boolean(existing.data.is_other);
    const name = isOther ? "Others" : cleanName(body.name);
    if (!name || name.length > 120) return jsonError("Provide a product name (maximum 120 characters).", 400);
    const priceCents = isOther ? null : body.priceCents;
    if (!isOther && !validPrice(priceCents)) return jsonError("Provide a valid product unit price.", 400);
    if (typeof body.active !== "boolean") return jsonError("Specify whether this item is active.", 400);
    const sortOrder = Number.isInteger(body.sortOrder) && Math.abs(body.sortOrder) <= 100000
      ? body.sortOrder : 0;
    const updated = await supabase.from("bgm_bar_catalog_items").update({
      name, price_cents: priceCents, active: body.active, sort_order: sortOrder,
      updated_by_system_user_id: auth.context.systemUserId,
      updated_at: new Date().toISOString(),
    }).eq("id", body.id)
      .select("id,name,price_cents,is_other,active,sort_order,updated_at").single();
    if (updated.error) {
      if (updated.error.code === "23505") return jsonError("Another Bar item already has that name.", 409);
      throw updated.error;
    }
    return NextResponse.json({ item: mapItem(updated.data) });
  } catch (error) {
    console.error("Bar catalogue update failed", error);
    return jsonError("Could not update this Bar item.", 500);
  }
}
