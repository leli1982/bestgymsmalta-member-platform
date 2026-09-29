import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { sortPendingApplicationsNewestFirst } from "@/lib/staffDashboardCore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    let applicationsQuery = supabase
      .from("bgm_membership_applications")
      .select(
        "id, application_reference, application_kind, application_source, reviewed_by_system_user_id, membership_type, enrollment_gym_id, status, submitted_at, created_at"
      )
      .in("status", ["submitted", "awaiting_payment"])
      .order("created_at", { ascending: false });

    if (!auth.context.isSuperAdmin) {
      if (!auth.context.gymId) {
        return NextResponse.json(
          { error: "This staff account is not assigned to a gym." },
          { status: 403 }
        );
      }
      applicationsQuery = applicationsQuery.eq(
        "enrollment_gym_id",
        auth.context.gymId
      );
    }

    const applicationsResult = await applicationsQuery;
    if (applicationsResult.error) throw applicationsResult.error;
    const applications = applicationsResult.data || [];

    if (applications.length === 0) {
      return NextResponse.json({ applications: [] });
    }

    const applicationIds = applications.map((application) => application.id);
    const gymIds = Array.from(
      new Set(applications.map((application) => application.enrollment_gym_id))
    );

    const [participantsResult, gymsResult] = await Promise.all([
      supabase
        .from("bgm_membership_application_members")
        .select(
          "id, application_id, participant_order, first_name, last_name, official_photo_path, existing_member_id, renewal_card_verified_at"
        )
        .in("application_id", applicationIds)
        .order("participant_order", { ascending: true }),
      supabase.from("bgm_gyms").select("id, name").in("id", gymIds),
    ]);

    if (participantsResult.error) throw participantsResult.error;
    if (gymsResult.error) throw gymsResult.error;

    const participants = participantsResult.data || [];
    const participantIds = participants.map((participant) => participant.id);
    const cardsResult = participantIds.length
      ? await supabase
          .from("bgm_member_card_credentials")
          .select("application_member_id, barcode_value, status")
          .in("application_member_id", participantIds)
          .eq("status", "reserved")
      : { data: [], error: null };

    if (cardsResult.error) throw cardsResult.error;

    const cardsByParticipant = new Map(
      (cardsResult.data || []).map((card) => [card.application_member_id, card])
    );
    const participantsByApplication = new Map<string, any[]>();
    for (const participant of participants) {
      const card = cardsByParticipant.get(participant.id);
      const list = participantsByApplication.get(participant.application_id) || [];
      list.push({
        id: participant.id,
        participantOrder: participant.participant_order,
        fullName: `${participant.first_name || ""} ${participant.last_name || ""}`.trim(),
        hasPhoto: Boolean(participant.official_photo_path),
        cardAssigned: Boolean(card?.barcode_value || participant.renewal_card_verified_at),
        reservedBarcode: card?.barcode_value || null,
      });
      participantsByApplication.set(participant.application_id, list);
    }

    const gymById = new Map(
      (gymsResult.data || []).map((gym) => [gym.id, gym.name])
    );
    const response = applications.map((application) => ({
      id: application.id,
      reference: application.application_reference,
      kind: application.application_kind,
      source: application.application_source,
      reviewedBySystemUserId: application.reviewed_by_system_user_id,
      status: application.status,
      membershipType: application.membership_type,
      enrollmentGymId: application.enrollment_gym_id,
      enrollmentGymName:
        gymById.get(application.enrollment_gym_id) || application.enrollment_gym_id,
      submittedAt: application.submitted_at,
      createdAt: application.created_at,
      participants: participantsByApplication.get(application.id) || [],
    }));

    return NextResponse.json({
      applications: sortPendingApplicationsNewestFirst(response),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load pending membership applications." },
      { status: 500 }
    );
  }
}
