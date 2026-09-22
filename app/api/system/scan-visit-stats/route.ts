import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";
import { summariseScanVisits, type CanonicalScanVisit } from "@/lib/scanVisitStatsCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const pageSize = 500;
const memberBatchSize = 300;
const maxRows = 100_000;

// This report counts accepted staffed card check-ins, not every scan attempt:
// canonical check-ins already deduplicate repeats within two hours at a gym.
// Self-service app QR check-ins are excluded deliberately.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const today = todayMaltaDate();
    const from = request.nextUrl.searchParams.get("from") || today.slice(0, 8) + "01";
    const to = request.nextUrl.searchParams.get("to") || today;
    const gymId = String(request.nextUrl.searchParams.get("gymId") || "").trim();
    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      return NextResponse.json({ error: "Select a valid Malta date range." }, { status: 400 });
    }
    if (gymId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymId)) {
      return NextResponse.json({ error: "Invalid gym selection." }, { status: 400 });
    }
    const start = maltaDayUtcRange(from).start;
    const end = maltaDayUtcRange(to).end;
    const supabase = getSupabaseAdmin();
    const names: Record<string, string> = {};
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from("bgm_gyms").select("id,name")
        .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      const gyms = result.data || [];
      for (const gym of gyms) names[gym.id] = gym.name || gym.id;
      if (gyms.length < pageSize) break;
    }
    if (gymId && !Object.prototype.hasOwnProperty.call(names, gymId)) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }

    const scans: CanonicalScanVisit[] = [];
    for (let offset = 0; ; offset += pageSize) {
      let query = supabase.from("bgm_member_checkins")
        .select("id,member_id,gym_id,checkin_at")
        .in("source", ["barcode", "nfc"])
        .gte("checkin_at", start).lt("checkin_at", end)
        .order("checkin_at", { ascending: true }).order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (gymId) query = query.eq("gym_id", gymId);
      const result = await query;
      if (result.error) throw result.error;
      const batch = (result.data || []) as CanonicalScanVisit[];
      scans.push(...batch);
      if (scans.length > maxRows) {
        return NextResponse.json({
          error: "This selection contains more than 100,000 check-ins. Choose a shorter date range for complete statistics.",
        }, { status: 413 });
      }
      if (batch.length < pageSize) break;
    }

    const memberIds = Array.from(new Set(scans.map((scan) => scan.member_id).filter(Boolean)));
    const enrollmentGyms: Record<string, string | null> = {};
    for (let offset = 0; offset < memberIds.length; offset += memberBatchSize) {
      const result = await supabase.from("bgm_members").select("id,enrollment_gym_id")
        .in("id", memberIds.slice(offset, offset + memberBatchSize));
      if (result.error) throw result.error;
      for (const member of result.data || []) enrollmentGyms[member.id] = member.enrollment_gym_id;
    }

    return NextResponse.json({
      range: { from, to, gymId, gymName: gymId ? names[gymId] : "All gyms" },
      ...summariseScanVisits(scans, enrollmentGyms, names),
      definition: "Successful barcode/NFC check-ins; repeated scans within two hours at the same gym count once. Self-service QR and denied scans are excluded. Enrollment gym is the member's currently recorded enrollment gym.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load gym check-in statistics:", error);
    return NextResponse.json({ error: "Could not load gym check-in statistics." }, { status: 500 });
  }
}
