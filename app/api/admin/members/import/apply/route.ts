import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.import");
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const batchId = String(body?.batchId || "").trim();
    if (!batchId) {
      return NextResponse.json(
        { error: "Import batch ID is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const result = await supabase.rpc("bgm_apply_member_import_batch", {
      p_batch_id: batchId,
      p_system_user_id: auth.context.systemUserId,
    });

    if (result.error) {
      const message = String(result.error.message || "");
      const reviewError =
        message.includes("unresolved") ||
        message.includes("not awaiting apply") ||
        message.includes("not found") ||
        message.includes("CardBarcode") ||
        message.includes("different active card") ||
        message.includes("already issued or reserved");

      return NextResponse.json(
        {
          error: reviewError
            ? message
            : "Could not apply the membership import batch.",
        },
        { status: reviewError ? 409 : 500 }
      );
    }

    return NextResponse.json({ applied: true, ...(result.data || {}) });
  } catch (error) {
    console.error("Membership import apply failed:", error);
    return NextResponse.json(
      { error: "Could not apply the membership import batch." },
      { status: 500 }
    );
  }
}
