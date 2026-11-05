import { NextRequest, NextResponse } from "next/server";
import { getSystemContext } from "@/lib/systemAuth";
import { urgentStaffAlertTopic } from "@/lib/urgentStaffAlertsRealtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await getSystemContext(request);
    if (!context || context.role !== "gym_staff" || !context.gymId)
      return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "private, no-store" } });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl || !publishableKey) return NextResponse.json({ enabled: false });
    return NextResponse.json({
      enabled: true, topic: urgentStaffAlertTopic(context.gymId),
      supabaseUrl, publishableKey,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Urgent alert Realtime configuration unavailable.", error);
    return NextResponse.json({ enabled: false });
  }
}
