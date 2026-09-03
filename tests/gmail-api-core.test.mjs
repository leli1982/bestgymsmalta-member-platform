import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const modulePath = new URL("../lib/gmailApiCore.ts", import.meta.url);

test("builds the Google refresh-token request without exposing secrets in the URL", async () => {
  assert.equal(existsSync(modulePath), true, "gmailApiCore.ts must exist");
  const core = await import(modulePath.href);

  const body = core.buildGoogleRefreshTokenBody({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
  });

  const params = new URLSearchParams(body);
  assert.equal(params.get("client_id"), "client-id");
  assert.equal(params.get("client_secret"), "client-secret");
  assert.equal(params.get("refresh_token"), "refresh-token");
  assert.equal(params.get("grant_type"), "refresh_token");
});

test("encodes a multipart operational email as Gmail base64url raw content", async () => {
  assert.equal(existsSync(modulePath), true, "gmailApiCore.ts must exist");
  const core = await import(modulePath.href);

  const raw = core.buildGmailRawMessage({
    from: "BestGymsMalta <bgm.members.app@gmail.com>",
    to: "orders@example.com",
    subject: "Sundries order - Birkirkara",
    text: "Plain text order",
    html: "<strong>HTML order</strong>",
  });

  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  assert.equal(raw.includes("="), false);

  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(decoded, /From: BestGymsMalta <bgm\.members\.app@gmail\.com>/);
  assert.match(decoded, /To: orders@example\.com/);
  assert.match(decoded, /Subject: Sundries order - Birkirkara/);
  assert.match(decoded, /Content-Type: multipart\/alternative/);
  assert.match(decoded, /Content-Type: text\/plain; charset="UTF-8"/);
  assert.match(decoded, /Content-Type: text\/html; charset="UTF-8"/);
});
