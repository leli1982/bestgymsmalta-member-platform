import { bgmAppAccessHtml, bgmAppAccessText, bgmEmailFooterHtml, bgmEmailFooterText } from "./emailBranding.ts";

type DeclarationSnapshot = {
  versionNo?: number | string | null;
  body?: string | null;
};

export type WelcomeDeclarations = {
  gymRules?: DeclarationSnapshot | null;
  health?: DeclarationSnapshot | null;
  privacy?: DeclarationSnapshot | null;
  guardian?: DeclarationSnapshot | null;
};

export type WelcomeEmailInput = {
  memberName: string;
  memberNumber: string;
  appUrl: string;
  applicationKind?: "new" | "renewal";
  declarations: WelcomeDeclarations;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function declarationSection(
  title: string,
  declaration: DeclarationSnapshot | null | undefined
) {
  const body = clean(declaration?.body);
  if (!body) return null;
  const version = clean(declaration?.versionNo);
  return { title, body, version };
}

export function buildWelcomeEmail(input: WelcomeEmailInput) {
  const memberName = clean(input.memberName) || "Member";
  const memberNumber = clean(input.memberNumber);
  const appUrl = clean(input.appUrl);
  const applicationKind = input.applicationKind === "renewal" ? "renewal" : "new";
  const isRenewal = applicationKind === "renewal";
  const sections = [
    declarationSection("Gym Rules", input.declarations.gymRules),
    declarationSection("Health Declaration", input.declarations.health),
    declarationSection("Privacy", input.declarations.privacy),
    declarationSection("Guardian Declaration", input.declarations.guardian),
  ].filter((value): value is { title: string; body: string; version: string } => Boolean(value));

  const textSections = sections.map((section) => {
    const versionText = section.version ? ` (Version ${section.version})` : "";
    return `${section.title}${versionText}\n${section.body}`;
  });

  const htmlSections = sections.map((section) => {
    const versionText = section.version ? ` <small>(Version ${escapeHtml(section.version)})</small>` : "";
    return `<section style="margin:24px 0"><h3 style="margin:0 0 8px">${escapeHtml(section.title)}${versionText}</h3><div style="white-space:pre-wrap;line-height:1.55">${escapeHtml(section.body)}</div></section>`;
  });

  const subject = isRenewal
    ? `BestGymsMalta membership renewed, ${memberName}`
    : `Welcome to BestGymsMalta, ${memberName}`;
  const heading = isRenewal
    ? `Your BestGymsMalta membership has been renewed, ${memberName}.`
    : `Welcome to BestGymsMalta, ${memberName}.`;
  const statusText = isRenewal
    ? "Your membership has been renewed successfully."
    : "Your membership has been activated successfully.";
  const memberNumberLabel = isRenewal
    ? "Your BGM membership number remains:"
    : "Your BGM membership number:";
  const registrationText = isRenewal
    ? null
    : "Use this membership number when registering for the BestGymsMalta member app.";
  const declarationsContext = isRenewal ? "your renewal" : "your enrollment";

  const text = [
    heading,
    statusText,
    "",
    memberNumberLabel,
    memberNumber,
    ...(registrationText ? [registrationText] : []),
    "",
    bgmAppAccessText(appUrl),
    "",
    `Below are the membership declarations and rules that apply to ${declarationsContext}:`,
    "",
    ...textSections,
    "",
    bgmEmailFooterText(),
  ].join("\n\n");

  const registrationHtml = registrationText
    ? `<div style="margin-top:6px;font-size:14px">${escapeHtml(registrationText)}</div>`
    : "";
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#18181b;line-height:1.5"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(statusText)}</p><div style="margin:20px 0;padding:16px;border:2px solid #f59e0b;border-radius:12px;background:#fff7ed"><div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#9a3412">${escapeHtml(memberNumberLabel)}</div><div style="margin-top:4px;font-size:28px;font-weight:800;letter-spacing:1px">${escapeHtml(memberNumber)}</div>${registrationHtml}</div>${bgmAppAccessHtml(appUrl)}<p>Below are the membership declarations and rules that apply to ${escapeHtml(declarationsContext)}:</p>${htmlSections.join("")}${bgmEmailFooterHtml()}</body></html>`;

  return { subject, text, html };
}
