import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWelcomeEmail } from "@/lib/welcomeMailer";
import type { WelcomeDeclarations } from "@/lib/welcomeEmailCore";

const WELCOME_AUDIT_ACTION = "membership.welcome_email.sent";
const RECENT_ACTIVATION_WINDOW_MS = 15 * 60 * 1000;

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function declarationFrom(value: unknown) {
  const record = asRecord(value);
  const body = String(record.body || "").trim();
  if (!body) return null;
  return {
    versionNo: record.versionNo ?? record.version_no ?? null,
    body,
  };
}

function memberAppUrl() {
  const configured = String(
    process.env.BGM_MEMBER_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://bestgymsmalta-member-platform.vercel.app/login"
  ).trim();
  return configured || "https://bestgymsmalta-member-platform.vercel.app/login";
}

async function resolveDeclarations(
  snapshotValue: unknown,
  includeGuardian: boolean
): Promise<WelcomeDeclarations> {
  const snapshot = asRecord(snapshotValue);
  const declarations: WelcomeDeclarations = {
    gymRules: declarationFrom(snapshot.gymRules || snapshot.gym_rules),
    health: declarationFrom(snapshot.health),
    privacy: declarationFrom(snapshot.privacy),
    guardian: includeGuardian ? declarationFrom(snapshot.guardian) : null,
  };

  const missingKeys: Array<"gym_rules" | "health" | "privacy" | "guardian"> = [];
  if (!declarations.gymRules) missingKeys.push("gym_rules");
  if (!declarations.health) missingKeys.push("health");
  if (!declarations.privacy) missingKeys.push("privacy");
  if (includeGuardian && !declarations.guardian) missingKeys.push("guardian");

  if (!missingKeys.length) return declarations;

  const supabase = getSupabaseAdmin();
  const published = await supabase
    .from("bgm_membership_declaration_versions")
    .select("content_key,version_no,body")
    .in("content_key", missingKeys)
    .eq("status", "published");

  if (published.error) throw published.error;

  for (const row of published.data || []) {
    const declaration = {
      versionNo: Number(row.version_no),
      body: String(row.body || "").trim(),
    };
    if (!declaration.body) continue;
    if (row.content_key === "gym_rules") declarations.gymRules = declaration;
    if (row.content_key === "health") declarations.health = declaration;
    if (row.content_key === "privacy") declarations.privacy = declaration;
    if (row.content_key === "guardian" && includeGuardian) declarations.guardian = declaration;
  }

  return declarations;
}

export async function sendWelcomePackagesBestEffort(applicationId: string) {
  const supabase = getSupabaseAdmin();
  const application = await supabase
    .from("bgm_membership_applications")
    .select("id,application_kind,enrollment_gym_id,declaration_snapshot")
    .eq("id", applicationId)
    .maybeSingle();

  if (application.error) throw application.error;
  if (!application.data || application.data.application_kind !== "new") return;

  const participants = await supabase
    .from("bgm_membership_application_members")
    .select("participant_order,first_name,last_name,email,guardian_name")
    .eq("application_id", applicationId)
    .order("participant_order", { ascending: true });

  if (participants.error) throw participants.error;

  const recipients = (participants.data || []).filter((row) =>
    Boolean(String(row.email || "").trim())
  );
  if (!recipients.length) return;

  const auditResult = await supabase
    .from("bgm_audit_log")
    .select("after_data")
    .eq("entity_type", "membership_application")
    .eq("entity_id", applicationId)
    .eq("action_key", WELCOME_AUDIT_ACTION);
  if (auditResult.error) throw auditResult.error;

  const alreadySent = new Set(
    (auditResult.data || [])
      .map((row) => String(asRecord(row.after_data).recipient || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const pendingRecipients = recipients.filter((row) =>
    !alreadySent.has(String(row.email || "").trim().toLowerCase())
  );
  if (!pendingRecipients.length) return;

  const includeGuardian = (participants.data || []).some((row) =>
    Boolean(String(row.guardian_name || "").trim())
  );
  const declarations = await resolveDeclarations(
    application.data.declaration_snapshot,
    includeGuardian
  );

  const appUrl = memberAppUrl();
  for (const row of pendingRecipients) {
    const recipient = String(row.email || "").trim().toLowerCase();
    try {
      await sendWelcomeEmail({
        recipient,
        memberName: `${String(row.first_name || "").trim()} ${String(row.last_name || "").trim()}`.trim(),
        appUrl,
        declarations,
      });

      const audit = await supabase.from("bgm_audit_log").insert({
        context_gym_id: application.data.enrollment_gym_id,
        staff_name: null,
        action_key: WELCOME_AUDIT_ACTION,
        entity_type: "membership_application",
        entity_id: applicationId,
        after_data: {
          recipient,
          participantOrder: row.participant_order,
          sentAt: new Date().toISOString(),
        },
      });
      if (audit.error) console.error(audit.error);
    } catch (error) {
      console.error(`Welcome email failed for ${recipient} on application ${applicationId}.`, error);
    }
  }
}

export async function sendWelcomePackagesForRecentlyActivatedMembersBestEffort(
  memberIds: string[]
) {
  const uniqueMemberIds = Array.from(new Set(memberIds.filter(Boolean)));
  if (!uniqueMemberIds.length) return;

  const supabase = getSupabaseAdmin();
  const memberLinks = await supabase
    .from("bgm_membership_members")
    .select("membership_id,member_id")
    .in("member_id", uniqueMemberIds);
  if (memberLinks.error) throw memberLinks.error;

  const membershipIds = Array.from(
    new Set((memberLinks.data || []).map((row) => row.membership_id).filter(Boolean))
  );
  if (!membershipIds.length) return;

  const memberships = await supabase
    .from("bgm_memberships")
    .select("id,application_id")
    .in("id", membershipIds);
  if (memberships.error) throw memberships.error;

  const applicationIds = Array.from(
    new Set((memberships.data || []).map((row) => row.application_id).filter(Boolean))
  );
  if (!applicationIds.length) return;

  const threshold = new Date(Date.now() - RECENT_ACTIVATION_WINDOW_MS).toISOString();
  const applications = await supabase
    .from("bgm_membership_applications")
    .select("id,application_kind,status,activated_at")
    .in("id", applicationIds)
    .eq("application_kind", "new")
    .eq("status", "activated")
    .gte("activated_at", threshold);
  if (applications.error) throw applications.error;

  for (const application of applications.data || []) {
    try {
      await sendWelcomePackagesBestEffort(application.id);
    } catch (error) {
      console.error(`Could not process welcome email for application ${application.id}.`, error);
    }
  }
}
