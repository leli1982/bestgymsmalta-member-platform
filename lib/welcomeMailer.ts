import nodemailer from "nodemailer";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";
import { buildWelcomeEmail, type WelcomeDeclarations } from "@/lib/welcomeEmailCore";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendWelcomeEmail(input: {
  recipient: string;
  memberName: string;
  appUrl: string;
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

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.appPassword },
    });
  }

  const email = buildWelcomeEmail(input);
  await cachedTransporter.sendMail({
    from: config.from,
    to: recipient,
    replyTo: config.user,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
