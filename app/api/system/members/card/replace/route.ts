import { NextRequest, NextResponse } from "next/server";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const REASONS = new Set(["lost", "stolen", "damaged", "other"]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "cards.replace");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const memberId = clean(body.memberId);
    const barcode = normalizeBarcodePayload(clean(body.barcode));
    const reason = clean(body.reason).toLowerCase();
    const requestedGymId = clean(body.gymId);
    const gymId = auth.context.gymId || requestedGymId;

    if (!memberId || !barcode) {
      return NextResponse.json(
        { error: "Member and new card barcode are required." },
        { status: 400 }
      );
    }
    if (!REASONS.has(reason)) {
      return NextResponse.json(
        { error: "Select a valid replacement reason: lost, stolen, damaged or other." },
        { status: 400 }
      );
    }
    if (!gymId) {
      return NextResponse.json({ error: "A gym context is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const result = await supabase.rpc("bgm_replace_member_card", {
      p_member_id: memberId,
      p_new_barcode: barcode,
      p_reason: reason,
      p_system_user_id: auth.context.systemUserId,
      p_context_gym_id: gymId,
    });

    if (result.error) {
      const message = String(result.error.message || "");
      const expected = /required|not found|different unused|already been issued|conflicts|valid replacement|active gym/i.test(message);
      return NextResponse.json(
        { error: expected ? message : "Could not issue the replacement card." },
        { status: expected ? 409 : 500 }
      );
    }

    return NextResponse.json({ ok: true, replacement: result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not issue the replacement card." }, { status: 500 });
  }
}
