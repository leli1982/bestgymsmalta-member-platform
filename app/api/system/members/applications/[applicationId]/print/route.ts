import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { pendingGuardianConsentGap } from "@/lib/guardianConsentSafety";
import { loadPrintableMembershipApplication } from "@/lib/printableMembershipApplication";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id, application_reference, enrollment_gym_id, status, application_source, reviewed_by_system_user_id, submitted_at, declaration_snapshot")
      .eq("id", applicationId)
      .maybeSingle();
    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }

    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id) {
      return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
    }
    if (
      application.application_source === "tablet" &&
      !application.reviewed_by_system_user_id &&
      ["submitted", "awaiting_payment"].includes(application.status)
    ) {
      return NextResponse.json(
        { error: "Confirm the online application review before preparing the membership form for printing." },
        { status: 409 }
      );
    }

    if (["submitted", "awaiting_payment"].includes(application.status)) {
      const participantsResult = await supabase
        .from("bgm_membership_application_members")
        .select("participant_order, date_of_birth, under_18_at_submission, guardian_name, guardian_id_number, guardian_relationship, guardian_phone, guardian_email, guardian_address")
        .eq("application_id", applicationId);
      if (participantsResult.error) throw participantsResult.error;
      const gap = pendingGuardianConsentGap(
        application.submitted_at,
        application.declaration_snapshot,
        participantsResult.data || []
      );
      if (gap) return NextResponse.json({ error: gap }, { status: 409 });
    }

    const printableApplication = await loadPrintableMembershipApplication(applicationId);
    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: null,
      action_key: "membership.application.print_requested",
      entity_type: "membership_application",
      entity_id: application.id,
      after_data: {
        applicationReference: application.application_reference,
        status: application.status,
        participantCount: printableApplication.participants.length,
      },
    });
    if (auditResult.error) console.error(auditResult.error);

    return NextResponse.json({ application: printableApplication });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not prepare this membership application for printing." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const body = await request.json().catch(() => ({}));
    if (String(body?.action || "") !== "confirm_print") {
      return NextResponse.json({ error: "Invalid print confirmation action." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id, application_reference, enrollment_gym_id, status, application_source, reviewed_by_system_user_id, submitted_at, declaration_snapshot")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }

    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id) {
      return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
    }

    if (application.application_source === "tablet" && !application.reviewed_by_system_user_id) {
      return NextResponse.json(
        { error: "Confirm the online application review before confirming the membership print." },
        { status: 409 }
      );
    }

    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return NextResponse.json(
        { error: "This membership application is no longer awaiting print confirmation." },
        { status: 409 }
      );
    }

    const participantsResult = await supabase
      .from("bgm_membership_application_members")
      .select("participant_order, date_of_birth, under_18_at_submission, guardian_name, guardian_id_number, guardian_relationship, guardian_phone, guardian_email, guardian_address")
      .eq("application_id", applicationId);
    if (participantsResult.error) throw participantsResult.error;
    const gap = pendingGuardianConsentGap(
      application.submitted_at,
      application.declaration_snapshot,
      participantsResult.data || []
    );
    if (gap) return NextResponse.json({ error: gap }, { status: 409 });

    const confirmedAt = new Date().toISOString();
    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: null,
      action_key: "membership.application.print_confirmed",
      entity_type: "membership_application",
      entity_id: application.id,
      after_data: {
        applicationReference: application.application_reference,
        status: application.status,
        confirmedAt,
      },
    });
    if (auditResult.error) throw auditResult.error;

    return NextResponse.json({ ok: true, confirmedAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not confirm that this membership was printed." },
      { status: 500 }
    );
  }
}
