type GoogleRefreshTokenInput = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type GmailRawMessageInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

function cleanHeader(value: string) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

export function buildGoogleRefreshTokenBody(input: GoogleRefreshTokenInput) {
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  }).toString();
}

export function buildGmailRawMessage(input: GmailRawMessageInput) {
  const boundary = "bgm-operational-order-alternative";
  const textBody = wrapBase64(Buffer.from(input.text, "utf8").toString("base64"));
  const htmlBody = wrapBase64(Buffer.from(input.html, "utf8").toString("base64"));

  const message = [
    `From: ${cleanHeader(input.from)}`,
    `To: ${cleanHeader(input.to)}`,
    `Subject: ${cleanHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    textBody,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlBody,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
