import { NextResponse } from "next/server";
import { currentMemberHero } from "@/lib/memberDashboardHero";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await currentMemberHero(), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Member dashboard hero lookup failed", error);
    // Keep a healthy fallback in the member app even during TEST migration rollout.
    return NextResponse.json({ imageUrl: null, updatedAt: null }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
