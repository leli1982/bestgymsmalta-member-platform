import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/api/member/google-wallet/health/route.ts", import.meta.url),
  "utf8",
);

test("Wallet health endpoint is Preview-only and never exposes secret values", () => {
  assert.match(source, /VERCEL_ENV/);
  assert.match(source, /preview/);
  assert.match(source, /GOOGLE_WALLET_PRIVATE_KEY/);
  assert.match(source, /privateKeyPresent/);
  assert.match(source, /privateKeyPemMarker/);
  assert.match(source, /configValid/);
  assert.doesNotMatch(source, /privateKey\s*[,}]/);
  assert.doesNotMatch(source, /serviceAccountEmail\s*[,}]/);
});
