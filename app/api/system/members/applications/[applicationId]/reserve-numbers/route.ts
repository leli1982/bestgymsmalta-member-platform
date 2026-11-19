import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

/**
 * Reserve the member number(s) while preparing the first physical application.
 * Number allocation is implemented as one atomic DB RPC and never comes from
 * a client-supplied number. The activated member will use this exact value.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;
    const { applicationId } = await params;

    const db = getSupabaseAdmin();
    // The RPC independently verifies this user, its gym and the application
    // state under row locks, preventing concurrent print and activation races.
    const result = await db.rpc("bgm_reserve_membership_application_numbers", {
      p_application_id: applicationId,
      p_system_user_id: auth.context.systemUserId,
    });
    if (result.error) {
      console.error("Member number reservation failed:", result.error.code);
      return NextResponse.json(
        { error: "Could not reserve the BGM member number. Do not print this form yet." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, reserved: result.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Member number print preparation failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { error: "Could not prepare membership printing. Please retry." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
