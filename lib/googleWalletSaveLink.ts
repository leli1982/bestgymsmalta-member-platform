import { createSign } from "node:crypto";

const SAVE_URL = "https://pay.google.com/gp/v/save/";

export type GoogleWalletSaveLinkConfig = {
  serviceAccountEmail: string;
  privateKey: string;
  origin: string;
  classId: string;
};

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function buildGoogleWalletSaveUrl(
  objectId: string,
  config: GoogleWalletSaveLinkConfig,
): string {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: config.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [config.origin],
    payload: {
      genericObjects: [
        {
          id: objectId,
          classId: config.classId,
        },
      ],
    },
  };
  const signingInput = `${encodeJwtPart(header)}.${encodeJwtPart(claims)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(config.privateKey).toString("base64url");
  return `${SAVE_URL}${signingInput}.${signature}`;
}
