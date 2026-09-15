import { NextRequest, NextResponse } from "next/server";
import { requireSystemPermission } from "@/lib/systemAuth";
import { staffMembershipTopic } from "@/lib/staffRealtime";

export const dynamic = "force-dynamic";

function publicRealtimeConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !publishableKey) return null;
  return { supabaseUrl, publishableKey };
}

export async function GET(request: NextRequest) {
  const auth = await requireSystemPermission(request, "members.create");
  if (auth.error || !auth.context) return auth.error;

  if (!auth.context.gymId) {
    return NextResponse.json({ enabled: false });
  }

  const config = publicRealtimeConfig();
  if (!config) {
    return NextResponse.json({ enabled: false });
  }

  try {
    return NextResponse.json({
      enabled: true,
      topic: staffMembershipTopic(auth.context.gymId),
      supabaseUrl: config.supabaseUrl,
      publishableKey: config.publishableKey,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ enabled: false });
  }
}
