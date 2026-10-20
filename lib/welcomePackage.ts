import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWelcomeEmail } from "@/lib/welcomeMailer";
import type { WelcomeDeclarations } from "@/lib/welcomeEmailCore";

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
    .select("id,application_kind,declaration_snapshot")
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

  const includeGuardian = (participants.data || []).some((row) =>
    Boolean(String(row.guardian_name || "").trim())
  );
  const declarations = await resolveDeclarations(
    application.data.declaration_snapshot,
    includeGuardian
  );

  const appUrl = memberAppUrl();
  const results = await Promise.allSettled(
    recipients.map((row) =>
      sendWelcomeEmail({
        recipient: String(row.email || ""),
        memberName: `${String(row.first_name || "").trim()} ${String(row.last_name || "").trim()}`.trim(),
        appUrl,
        declarations,
      })
    )
  );

  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    console.error(`Welcome email failed for ${failed.length} recipient(s) on application ${applicationId}.`);
  }
}
