import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { scopedConflictCandidates } from "@/lib/scopedCardConflictCandidates";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
const barcodeOf = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase() : "";
function validBarcode(barcode: string) {
  return barcode.length > 0 && barcode.length <= 128 && !barcode.startsWith("RETIRED-");
}
function failure(error: { code?: string; message?: string }) {
  if (error.code === "42501") return reply({ error: "Super Admin access required." }, 403);
  if (error.code === "55P03" || error.code === "40P01") return reply({ error: "Card records are busy. Please search again and retry." }, 409);
  if (error.code === "40001" || error.code === "22023" || error.code === "23505")
    return reply({ error: error.code === "23505" ? "Card assignment changed. Search again." : error.message }, 409);
  console.error("Card management RPC failed", error.code);
  return reply({ error: "Card management is unavailable. No release was confirmed." }, 500);
}
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const barcode = barcodeOf(request.nextUrl.searchParams.get("barcode"));
    if (!validBarcode(barcode)) return reply({ error: "Enter a valid physical card number." }, 400);
    const result = await getSupabaseAdmin().rpc("bgm_card_release_lookup", {
      p_system_user_id: auth.context.systemUserId, p_barcode: barcode,
    });
    if (result.error) return failure(result.error);
    if (scopedConflictCandidates(barcode).length) return reply({
      ...result.data, status: "conflict", canRelease: false,
      blockedReason: "This barcode belongs to the existing scoped card conflict workflow. Review it there.",
    });
    return reply(result.data);
  } catch {
    return reply({ error: "Could not look up this card." }, 500);
  }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    const barcode = barcodeOf(body?.barcode);
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!validBarcode(barcode) || !reason || reason.length > 500 ||
      body?.confirmed !== true || !body?.expected || typeof body.expected !== "object" ||
      Array.isArray(body.expected) || body.expected.barcode !== barcode)
      return reply({ error: "Card lookup, confirmation and a reason are required." }, 400);
    if (scopedConflictCandidates(barcode).length)
      return reply({ error: "Use the existing scoped card conflict workflow for this barcode." }, 409);
    const result = await getSupabaseAdmin().rpc("bgm_release_physical_card", {
      p_system_user_id: auth.context.systemUserId, p_barcode: barcode,
      p_expected: body.expected, p_reason: reason, p_confirmed: true,
      p_confirm_active: body.confirmActive === true,
    });
    if (result.error) return failure(result.error);
    return reply(result.data);
  } catch {
    return reply({ error: "Could not confirm the release. Search again to verify the card status." }, 500);
  }
}
