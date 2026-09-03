import { Resend } from "resend";
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
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
  });

  if (!config) {
    throw new Error("Operational order email is not configured.");
  }

  const recipient = input.recipient.trim();
  if (!recipient) {
    throw new Error("Operational order recipient is not configured.");
  }

  const email = buildOperationalOrderEmail(input);
  const resend = new Resend(config.apiKey);
  const result = await resend.emails.send({
    from: config.from,
    to: recipient,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (result.error) {
    throw new Error(result.error.message || "Resend email delivery failed.");
  }
}
