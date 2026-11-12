import assert from "node:assert/strict";
import test from "node:test";
import { sealHu20Template, openHu20Template } from "../lib/hu20BiometricVault.ts";

const testUrl = "https://vlvyqdjhzdcxatilbdiv.supabase.co";
const env = {
  BGM_HU20_TEST_ENABLED: "true",
  VERCEL_ENV: "preview",
  SUPABASE_URL: testUrl,
  NEXT_PUBLIC_SUPABASE_URL: testUrl,
  BGM_HU20_TEMPLATE_KEY: "a4".repeat(32),
};
const context = {
  employeeId: "23e5e35d-ac73-4de4-acd4-0198437e60bf",
  credentialId: "13e5e35d-ac73-4de4-acd4-0198437e60bf",
  templateFormat: "ANSI378",
};
const sample = Buffer.alloc(400, 0x7b);

test("HU20 vault encrypts with random AES-GCM nonce and authenticates employee binding", () => {
  const a = sealHu20Template(sample, context, env);
  const b = sealHu20Template(sample, context, env);
  assert.notEqual(a, b);
  assert.equal(a.includes(sample.toString("base64url")), false);
  assert.deepEqual(openHu20Template(a, context, env), sample);
  assert.throws(() => openHu20Template(a, { ...context, employeeId: "33e5e35d-ac73-4de4-acd4-0198437e60bf" }, env));
  assert.throws(() => openHu20Template(a, { ...context, credentialId: "23e5e35d-ac73-4de4-acd4-0198437e60bf" }, env));
  const parts = a.split(".");
  parts[3] = Buffer.alloc(400, 0).toString("base64url");
  assert.throws(() => openHu20Template(parts.join("."), context, env));
});
test("HU20 vault fails closed for Production, another database, missing key and invalid size", () => {
  assert.throws(() => sealHu20Template(sample, context, { ...env, VERCEL_ENV: "production" }));
  assert.throws(() => openHu20Template(sealHu20Template(sample, context, env), context, {
    ...env, SUPABASE_URL: "https://jsuolemirhivqhjbjetv.supabase.co",
  }));
  assert.throws(() => sealHu20Template(sample, context, { ...env, BGM_HU20_TEMPLATE_KEY: undefined }));
  assert.throws(() => sealHu20Template(Buffer.alloc(12), context, env));
});
