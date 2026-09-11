import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "barcode.scan");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const scanId = clean(body.scanId);
    if (!scanId) {
      return NextResponse.json({ error: "Access scan is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const finalizeResult = await supabase.rpc(
      "bgm_finalize_photo_required_barcode_access",
      {
        p_scan_id: scanId,
        p_system_user_id: auth.context.systemUserId,
      }
    );

    if (finalizeResult.error) {
      const message = finalizeResult.error.message || "Could not finalize access.";
      const status = /photo|awaiting|session|scan/i.test(message) ? 409 : 500;
      return NextResponse.json({ error: message }, { status });
    }

    const result = finalizeResult.data || {};
    return NextResponse.json({
      ...result,
      granted: result.granted === true,
      duplicate: result.duplicate === true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not finalize reception access." },
      { status: 500 }
    );
  }
}
