import { buildOperationalOrderEmail } from "@/lib/operationalOrderEmail";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";
import {
  buildGmailRawMessage,
  buildGoogleRefreshTokenBody,
} from "@/lib/gmailApiCore";
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

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GmailErrorResponse = {
  error?: {
    message?: string;
  };
};

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function sendOperationalOrderEmail(input: SendOperationalOrderInput) {
  const config = resolveOperationsMailConfig({
    GMAIL_API_CLIENT_ID: process.env.GMAIL_API_CLIENT_ID,
    GMAIL_API_CLIENT_SECRET: process.env.GMAIL_API_CLIENT_SECRET,
    GMAIL_API_REFRESH_TOKEN: process.env.GMAIL_API_REFRESH_TOKEN,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_FROM: process.env.GMAIL_FROM,
  });

  if (!config) {
    throw new Error("Operational order Gmail API email is not configured.");
  }

  const recipient = input.recipient.trim();
  if (!recipient) {
    throw new Error("Operational order recipient is not configured.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: buildGoogleRefreshTokenBody({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
    }),
  });

  const tokenPayload = await readJson<GoogleTokenResponse>(tokenResponse);
  const accessToken = tokenPayload?.access_token;
  if (!tokenResponse.ok || !accessToken) {
    const reason =
      tokenPayload?.error_description ||
      tokenPayload?.error ||
      `Google OAuth token request failed (${tokenResponse.status}).`;
    throw new Error(reason);
  }

  const email = buildOperationalOrderEmail(input);
  const raw = buildGmailRawMessage({
    from: config.from,
    to: recipient,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  const gmailResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!gmailResponse.ok) {
    const payload = await readJson<GmailErrorResponse>(gmailResponse);
    throw new Error(
      payload?.error?.message ||
        `Gmail API message send failed (${gmailResponse.status}).`
    );
  }
}
