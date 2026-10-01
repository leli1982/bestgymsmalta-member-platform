import nodemailer from "nodemailer";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";

type RefundAlertEmailInput = {
  recipient: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  mobile: string;
  voucherCode: string;
  voucherPercentage: number;
  refundDueCents: number;
  currency: string;
};

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(cents / 100);
}

export async function sendMemberRefundAlertEmail(input: RefundAlertEmailInput) {
  const config = resolveOperationsMailConfig({
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });
  if (!config) throw new Error("Super Admin notification email is not configured.");
  const recipient = input.recipient.trim();
  if (!recipient) throw new Error("Super Admin notification recipient is not configured.");

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.appPassword },
    });
  }

  const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ") || "Member";
  const refund = money(input.refundDueCents, input.currency);
  const subject = `BGM refund required · ${fullName} · ${refund}`;
  const text = [
    "BestGymsMalta — Refund Required",
    "",
    `Member: ${fullName}`,
    `ID / Passport: ${input.idNumber || "Not recorded"}`,
    `Mobile: ${input.mobile || "Not recorded"}`,
    `Voucher applied: ${input.voucherCode} (${input.voucherPercentage}%)`,
    `Refund due: ${refund}`,
    "",
    "This refund alert was created because a Super Admin applied a voucher retroactively to an already-paid membership.",
    "The alert remains pending in Super Admin until marked handled.",
  ].join("\n");

  const html = `
    <h2>BestGymsMalta — Refund Required</h2>
    <p><strong>Member:</strong> ${fullName}</p>
    <p><strong>ID / Passport:</strong> ${input.idNumber || "Not recorded"}</p>
    <p><strong>Mobile:</strong> ${input.mobile || "Not recorded"}</p>
    <p><strong>Voucher applied:</strong> ${input.voucherCode} (${input.voucherPercentage}%)</p>
    <p><strong>Refund due:</strong> ${refund}</p>
    <p>This refund alert was created because a Super Admin applied a voucher retroactively to an already-paid membership.</p>
    <p>The alert remains pending in Super Admin until marked handled.</p>
  `;

  await cachedTransporter.sendMail({
    from: config.from,
    to: recipient,
    replyTo: config.user,
    subject,
    text,
    html,
  });
}
