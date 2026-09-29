import nodemailer from "nodemailer";
import { buildMembershipReminderEmail, type MembershipReminderDays } from "@/lib/membershipReminderCore";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendMembershipReminderEmail(input: {
  recipient: string;
  memberName: string;
  expiryDate: string;
  daysBefore: MembershipReminderDays;
}) {
  const config = resolveOperationsMailConfig({
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });
  if (!config) throw new Error("Membership reminder email is not configured.");

  const recipient = input.recipient.trim();
  if (!recipient) throw new Error("Member email address is missing.");

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.appPassword },
    });
  }

  const email = buildMembershipReminderEmail(input);
  await cachedTransporter.sendMail({
    from: config.from,
    to: recipient,
    replyTo: config.user,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
