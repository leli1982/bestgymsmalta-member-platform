import nodemailer from "nodemailer";
import { buildOperationalOrderEmail } from "@/lib/operationalOrderEmail";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";
import type { OperationalOrderItem, OperationalOrderType } from "@/lib/operationalOrdersCore";

type SendOperationalOrderInput = {
  recipient: string;
  orderType: OperationalOrderType;
  orderId: string;
  gymName: string;
  staffName: string;
  notes?: string | null;
  items: OperationalOrderItem[];
};

export async function sendOperationalOrderEmail(input: SendOperationalOrderInput) {
  const config = resolveOperationsMailConfig({
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });

  if (!config) {
    throw new Error("Operational order email is not configured.");
  }

  const recipient = input.recipient.trim();
  if (!recipient) {
    throw new Error("Operational order recipient is not configured.");
  }

  const email = buildOperationalOrderEmail(input);
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
