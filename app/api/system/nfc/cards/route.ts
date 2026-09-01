import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeCardUid(value: unknown) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

async function audit({
  systemUserId,
  gymId,
  staffName,
  actionKey,
  memberId,
  entityId,
  afterData,
}: {
  systemUserId: string;
  gymId: string | null;
  staffName: string;
  actionKey: string;
  memberId: string;
  entityId: string;
  afterData: unknown;
}) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("bgm_audit_log").insert({
    system_user_id: systemUserId,
    context_gym_id: gymId,
    staff_name: staffName,
    action_key: actionKey,
    entity_type: "nfc_card",
    entity_id: entityId,
    member_id: memberId,
    after_data: afterData,
  });
  if (result.error) throw result.error;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "nfc.assign");
    if (auth.error || !auth.context) return auth.error;

    const memberId = clean(request.nextUrl.searchParams.get("memberId"));
    if (!memberId) return NextResponse.json({ cards: [] });

    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_nfc_cards")
      .select("id, card_uid, member_id, status, assigned_gym_id, assigned_staff_name, assigned_at, disabled_at, disabled_staff_name, replacement_card_id, notes")
      .eq("member_id", memberId)
      .order("assigned_at", { ascending: false });

    if (result.error) throw result.error;
    return NextResponse.json({ cards: result.data || [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load NFC cards." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "nfc.assign");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const memberId = clean(body.memberId);
    const cardUid = normalizeCardUid(body.cardUid);
    const staffName = clean(body.staffName);
    const notes = clean(body.notes);

    if (!memberId || !cardUid || !staffName) {
      return NextResponse.json(
        { error: "Member, NFC card UID and Staff Name are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();
    if (memberResult.error) throw memberResult.error;
    if (!memberResult.data) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const activeResult = await supabase
      .from("bgm_nfc_cards")
      .select("id")
      .eq("member_id", memberId)
      .eq("status", "active")
      .maybeSingle();
    if (activeResult.error) throw activeResult.error;
    if (activeResult.data) {
      return NextResponse.json(
        { error: "This member already has an active NFC card. Use Replace Card instead." },
        { status: 409 }
      );
    }

    const insertResult = await supabase
      .from("bgm_nfc_cards")
      .insert({
        card_uid: cardUid,
        member_id: memberId,
        status: "active",
        assigned_gym_id: auth.context.gymId,
        assigned_by_system_user_id: auth.context.systemUserId,
        assigned_staff_name: staffName,
        notes: notes || null,
      })
      .select("id, card_uid, member_id, status, assigned_gym_id, assigned_staff_name, assigned_at")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return NextResponse.json({ error: "That NFC card is already assigned." }, { status: 409 });
      }
      throw insertResult.error;
    }

    await audit({
      systemUserId: auth.context.systemUserId,
      gymId: auth.context.gymId,
      staffName,
      actionKey: "nfc_card.assigned",
      memberId,
      entityId: insertResult.data.id,
      afterData: { cardUid: insertResult.data.card_uid },
    });

    return NextResponse.json({ card: insertResult.data }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not assign NFC card." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const action = clean(body.action).toLowerCase();
    const auth = await requireSystemPermission(
      request,
      action === "replace" ? "nfc.replace" : "nfc.assign"
    );
    if (auth.error || !auth.context) return auth.error;

    const cardId = clean(body.cardId);
    const staffName = clean(body.staffName);
    const newCardUid = normalizeCardUid(body.newCardUid);

    if (!cardId || !staffName || !["disable", "replace"].includes(action)) {
      return NextResponse.json(
        { error: "Card, action and Staff Name are required." },
        { status: 400 }
      );
    }
    if (action === "replace" && !newCardUid) {
      return NextResponse.json({ error: "New NFC card UID is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const existingResult = await supabase
      .from("bgm_nfc_cards")
      .select("id, card_uid, member_id, status")
      .eq("id", cardId)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;

    const existing = existingResult.data;
    if (!existing) return NextResponse.json({ error: "NFC card not found." }, { status: 404 });
    if (existing.status !== "active") {
      return NextResponse.json({ error: "Only an active NFC card can be changed." }, { status: 409 });
    }

    const now = new Date().toISOString();

    if (action === "disable") {
      const updateResult = await supabase
        .from("bgm_nfc_cards")
        .update({
          status: "disabled",
          disabled_at: now,
          disabled_by_system_user_id: auth.context.systemUserId,
          disabled_staff_name: staffName,
          updated_at: now,
        })
        .eq("id", cardId)
        .select("id, card_uid, member_id, status, disabled_at")
        .single();
      if (updateResult.error) throw updateResult.error;

      await audit({
        systemUserId: auth.context.systemUserId,
        gymId: auth.context.gymId,
        staffName,
        actionKey: "nfc_card.disabled",
        memberId: existing.member_id,
        entityId: cardId,
        afterData: { cardUid: existing.card_uid },
      });
      return NextResponse.json({ card: updateResult.data });
    }

    const retireResult = await supabase
      .from("bgm_nfc_cards")
      .update({
        status: "replaced",
        disabled_at: now,
        disabled_by_system_user_id: auth.context.systemUserId,
        disabled_staff_name: staffName,
        updated_at: now,
      })
      .eq("id", cardId);
    if (retireResult.error) throw retireResult.error;

    const newCardResult = await supabase
      .from("bgm_nfc_cards")
      .insert({
        card_uid: newCardUid,
        member_id: existing.member_id,
        status: "active",
        assigned_gym_id: auth.context.gymId,
        assigned_by_system_user_id: auth.context.systemUserId,
        assigned_staff_name: staffName,
      })
      .select("id, card_uid, member_id, status, assigned_at")
      .single();

    if (newCardResult.error) {
      await supabase
        .from("bgm_nfc_cards")
        .update({
          status: "active",
          disabled_at: null,
          disabled_by_system_user_id: null,
          disabled_staff_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cardId);

      if (newCardResult.error.code === "23505") {
        return NextResponse.json({ error: "That NFC card is already assigned." }, { status: 409 });
      }
      throw newCardResult.error;
    }

    const linkResult = await supabase
      .from("bgm_nfc_cards")
      .update({ replacement_card_id: newCardResult.data.id, updated_at: new Date().toISOString() })
      .eq("id", cardId);

    if (linkResult.error) throw linkResult.error;

    await audit({
      systemUserId: auth.context.systemUserId,
      gymId: auth.context.gymId,
      staffName,
      actionKey: "nfc_card.replaced",
      memberId: existing.member_id,
      entityId: cardId,
      afterData: {
        oldCardUid: existing.card_uid,
        newCardUid,
        replacementCardId: newCardResult.data.id,
      },
    });

    return NextResponse.json({ card: newCardResult.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update NFC card." }, { status: 500 });
  }
}
