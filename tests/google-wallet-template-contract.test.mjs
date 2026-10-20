import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("../lib/googleWalletServer.ts", import.meta.url));
const source = readFileSync(serverPath, "utf8");

test("Google Wallet class defines the approved member card layout", () => {
  assert.match(source, /function\s+googleClassBody/);
  assert.match(source, /classTemplateInfo/);
  assert.match(source, /cardTemplateOverride/);
  assert.match(source, /cardRowTemplateInfos/);
  assert.match(source, /object\.textModulesData\['membership_type'\]/);
  assert.match(source, /object\.textModulesData\['membership_status'\]/);
  assert.match(source, /object\.textModulesData\['membership_expiry'\]/);
  assert.match(source, /object\.textModulesData\['brand_tagline'\]/);
  assert.match(source, /cardBarcodeSectionDetails/);
  assert.match(source, /object\.textModulesData\['member_number'\]/);
});

test("existing Google Wallet class is PATCHed so already-issued passes receive the approved layout", () => {
  assert.match(source, /existing\.ok[\s\S]*method:\s*"PATCH"[\s\S]*googleClassBody\(config\)/);
});
