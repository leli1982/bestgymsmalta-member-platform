import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function mapRow(row: any) {
  return {
    id: row.id,
    code: row.code,
    percentage: Number(row.percentage || 0),
    active: Boolean(row.active),
    reimbursementValueCents: row.reimbursement_value_cents === null ? null : Number(row.reimbursement_value_cents),
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const result = await getSupabaseAdmin().from("bgm_discount_codes")
      .select("id,code,percentage,active,reimbursement_value_cents,updated_at")
      .order("code", { ascending: true });
    if (result.error) throw result.error;
    return NextResponse.json({ vouchers: (result.data || []).map(mapRow) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Voucher reimbursement settings read failed", error);
    return jsonError("Could not load voucher reimbursement values.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    const id = clean(body.id);
    if (!id) return jsonError("Select a voucher.", 400);
    let reimbursementValueCents: number | null = null;
    if (body.reimbursementValueCents !== null && body.reimbursementValueCents !== undefined && body.reimbursementValueCents !== "") {
      reimbursementValueCents = Number(body.reimbursementValueCents);
      if (!Number.isSafeInteger(reimbursementValueCents) || reimbursementValueCents < 0 || reimbursementValueCents > 100_000_000) {
        return jsonError("Value € must be a valid non-negative amount.", 400);
      }
    }

    const supabase = getSupabaseAdmin();
    const existing = await supabase.from("bgm_discount_codes")
      .select("id,code,percentage,reimbursement_value_cents")
      .eq("id", id).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return jsonError("Voucher not found.", 404);

    const updated = await supabase.from("bgm_discount_codes")
      .update({ reimbursement_value_cents: reimbursementValueCents, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,code,percentage,active,reimbursement_value_cents,updated_at")
      .single();
    if (updated.error) throw updated.error;

    const audit = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: null,
      staff_name: null,
      action_key: "membership_settings.voucher_reimbursement.saved",
      entity_type: "membership_discount_code",
      entity_id: id,
      before_data: existing.data,
      after_data: updated.data,
    });
    if (audit.error) throw audit.error;

    return NextResponse.json({ ok: true, voucher: mapRow(updated.data) });
  } catch (error) {
    console.error("Voucher reimbursement settings update failed", error);
    return jsonError("Could not save voucher reimbursement value.", 500);
  }
}
