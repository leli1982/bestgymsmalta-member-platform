import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaffTerminal } from "@/lib/staffTerminalRequest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffTerminal(request);
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const gymResult = await supabase
      .from("bgm_gyms")
      .select("id, name, status")
      .eq("id", auth.context.gymId)
      .maybeSingle();
    if (gymResult.error) throw gymResult.error;
    if (!gymResult.data) {
      return NextResponse.json({ error: "Punch Clock terminal gym not found." }, { status: 409 });
    }

    return NextResponse.json({
      terminal: {
        id: auth.context.terminalId,
        name: auth.context.name,
        active: true,
      },
      gym: {
        id: gymResult.data.id,
        name: gymResult.data.name,
        status: gymResult.data.status,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not verify Punch Clock terminal." }, { status: 500 });
  }
}
