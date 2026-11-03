import nodemailer from "nodemailer";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";
import { buildWelcomeEmail, type WelcomeDeclarations } from "@/lib/welcomeEmailCore";
import { buildGymRulesPdf, gymRulesPdfFilename } from "@/lib/gymRulesPdf";
import {
  buildDeclarationPdf,
  declarationPdfFilename,
  type DeclarationPdfInput,
} from "@/lib/declarationPdf";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

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
}) {
  const config = resolveOperationsMailConfig({
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });
  if (!config) throw new Error("Welcome email is not configured.");

  const recipient = String(input.recipient || "").trim().toLowerCase();
  if (!recipient) throw new Error("Member email address is missing.");

  const gymRules = input.declarations.gymRules;
  if (!String(gymRules?.body || "").trim()) {
    throw new Error("Accepted Gym Rules are missing from the welcome package.");
  }
  const health = input.declarations.health;
  if (!String(health?.body || "").trim()) {
    throw new Error("Accepted Health Declaration is missing from the welcome package.");
  }
  const privacy = input.declarations.privacy;
  if (!String(privacy?.body || "").trim()) {
    throw new Error("Accepted Privacy / GDPR declaration is missing from the welcome package.");
  }

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
        filename: gymRulesPdfFilename(gymRules!),
        content: gymRulesPdf,
        contentType: "application/pdf",
      },
      ...declarationAttachments,
    ],
  });
}
