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
  appUrl: string;
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
  const appUrl = clean(input.appUrl);
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

  const subject = `Welcome to BestGymsMalta, ${memberName}`;
  const text = [
    `Welcome to BestGymsMalta, ${memberName}.`,
    "Your membership has been activated successfully.",
    "",
    "Access the BestGymsMalta member app here:",
    appUrl,
    "",
    "Below are the membership declarations and rules that apply to your enrollment:",
    "",
    ...textSections,
  ].join("\n\n");

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#18181b;line-height:1.5"><h2>Welcome to BestGymsMalta, ${escapeHtml(memberName)}.</h2><p>Your membership has been activated successfully.</p><p><strong>Access the BestGymsMalta member app:</strong><br><a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p><p>Below are the membership declarations and rules that apply to your enrollment:</p>${htmlSections.join("")}</body></html>`;

  return { subject, text, html };
}
