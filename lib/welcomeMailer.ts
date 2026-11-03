import nodemailer from "nodemailer";
import { bgmEmailFooterHtml, bgmEmailFooterText } from "@/lib/emailBranding";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";
import { buildWelcomeEmail, type WelcomeDeclarations } from "@/lib/welcomeEmailCore";
import { buildGymRulesPdf, gymRulesPdfFilename } from "@/lib/gymRulesPdf";
import {
  buildDeclarationPdf,
  declarationPdfFilename,
  type DeclarationPdfInput,
} from "@/lib/declarationPdf";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function configuredMailer() {
  const config = resolveOperationsMailConfig({
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });
  if (!config) throw new Error("Welcome email is not configured.");

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.appPassword },
    });
  }

  return { config, transporter: cachedTransporter };
}

function declarationAttachment(input: DeclarationPdfInput) {
  return {
    filename: declarationPdfFilename(input),
    content: buildDeclarationPdf(input),
    contentType: "application/pdf",
  };
}

export async function sendWelcomeEmail(input: {
  recipient: string;
  memberName: string;
  memberNumber: string;
  appUrl: string;
  applicationKind?: "new" | "renewal";
  declarations: WelcomeDeclarations;
  membershipFormPdf: { filename: string; content: Buffer };
}) {
  const config = resolveOperationsMailConfig({
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });
  if (!config) throw new Error("Welcome email is not configured.");

  const recipient = String(input.recipient || "").trim().toLowerCase();
  if (!recipient) throw new Error("Member email address is missing.");
  if (!input.membershipFormPdf?.filename?.startsWith("BestGymsMalta-Membership-")) {
    throw new Error("BestGymsMalta-Membership PDF is missing from the welcome package.");
  }

  const gymRules = input.declarations.gymRules;
  if (!String(gymRules?.body || "").trim()) throw new Error("Accepted Gym Rules are missing from the welcome package.");
  const health = input.declarations.health;
  if (!String(health?.body || "").trim()) throw new Error("Accepted Health Declaration is missing from the welcome package.");
  const privacy = input.declarations.privacy;
  if (!String(privacy?.body || "").trim()) throw new Error("Accepted Privacy / GDPR declaration is missing from the welcome package.");

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.appPassword },
    });
  }

  const email = buildWelcomeEmail(input);
  const gymRulesPdf = buildGymRulesPdf(gymRules!);
  const declarationAttachments = [
    declarationAttachment({
      title: "Health Declaration",
      filenameLabel: "Health-Declaration",
      sourceKey: "Health-Declaration",
      declaration: health!,
    }),
    declarationAttachment({
      title: "Privacy / GDPR",
      filenameLabel: "Privacy-GDPR",
      sourceKey: "Privacy-GDPR",
      declaration: privacy!,
    }),
  ];
  if (input.declarations.guardian) {
    declarationAttachments.push(
      declarationAttachment({
        title: "Guardian Consent",
        filenameLabel: "Guardian-Consent",
        sourceKey: "Guardian-Consent",
        declaration: input.declarations.guardian,
      })
    );
  }

  await cachedTransporter.sendMail({
    from: config.from,
    to: recipient,
    replyTo: config.user,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: [
      {
        filename: input.membershipFormPdf.filename,
        content: input.membershipFormPdf.content,
        contentType: "application/pdf",
      },
      {
        filename: gymRulesPdfFilename(gymRules!),
        content: gymRulesPdf,
        contentType: "application/pdf",
      },
      ...declarationAttachments,
    ],
  });
}

export async function sendLegacyActivationConfirmationEmail(input: {
  recipient: string;
  memberName: string;
  memberNumber: string;
  appUrl: string;
}) {
  const recipient = String(input.recipient || "").trim().toLowerCase();
  if (!recipient) throw new Error("Member email address is missing.");

  const memberName = String(input.memberName || "").trim() || "Member";
  const memberNumber = String(input.memberNumber || "").trim();
  const appUrl = String(input.appUrl || "").trim();
  const { config, transporter } = configuredMailer();

  const subject = "Your BestGymsMalta member app is activated";
  const text = [
    `Hi ${memberName},`,
    "",
    "Your BestGymsMalta member app account has been activated successfully.",
    "",
    `Your BGM membership number: ${memberNumber}`,
    "",
    "You can now log in to the member app here:",
    appUrl,
    "",
    bgmEmailFooterText(),
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#18181b;line-height:1.5"><h2>Your BestGymsMalta member app is activated</h2><p>Hi ${escapeHtml(memberName)},</p><p>Your BestGymsMalta member app account has been activated successfully.</p><div style="margin:20px 0;padding:16px;border:2px solid #f59e0b;border-radius:12px;background:#fff7ed"><div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#9a3412">Your BGM membership number</div><div style="margin-top:4px;font-size:28px;font-weight:800;letter-spacing:1px">${escapeHtml(memberNumber)}</div></div><p><strong>Log in to the BestGymsMalta member app:</strong><br><a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>${bgmEmailFooterHtml()}</body></html>`;

  await transporter.sendMail({
    from: config.from,
    to: recipient,
    replyTo: config.user,
    subject,
    text,
    html,
  });
}
