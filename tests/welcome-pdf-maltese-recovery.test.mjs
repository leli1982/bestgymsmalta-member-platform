import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDeclarationPdf } from "../lib/declarationPdf.ts";

test("Maltese names and declarations cannot break a welcome PDF", () => {
  const body = "Ġużeppi Żammit, Ħal Ġhaxaq — Ċentru. Ċ Ġ Ħ Ż ġ ħ ż ċ";
  const pdf = buildDeclarationPdf({
    title: "Completed Membership Form", filenameLabel: "Membership-Form", sourceKey: "Membership-Form",
    declaration: { versionNo: 1, body },
  });
  const source = pdf.toString("latin1");
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(source.includes("BGM-Membership-Form-UTF8-Base64: " + Buffer.from(body, "utf8").toString("base64")));
  assert.match(source, /Guz[eé]ppi Zammit, Hal Ghaxaq/);
  assert.match(source, /C G H Z g h z c/);
});

test("Unknown Unicode has safe fallback while exact original UTF-8 is preserved", () => {
  const body = "Rule for 😀 and example 運動";
  const pdf = buildDeclarationPdf({
    title: "Gym Rules", filenameLabel: "Gym-Rules", sourceKey: "Gym-Rules",
    declaration: { body },
  });
  const output = pdf.toString("latin1");
  assert.match(output, /Rule for \? and example/);
  assert.ok(output.includes("BGM-Gym-Rules-UTF8-Base64: " + Buffer.from(body, "utf8").toString("base64")));
});

test("One-time replay is POST-only, authenticated, date-limited and audit-based", () => {
  const code = readFileSync(new URL("../app/api/system/maintenance/replay-welcome-20261111/route.ts", import.meta.url), "utf8");
  assert.match(code, /export async function POST\(/);
  assert.doesNotMatch(code, /export async function GET\(/);
  assert.match(code, /timingSafeEqual/);
  assert.match(code, /BGM_ONE_OFF_WELCOME_REPLAY_TOKEN/);
  assert.match(code, /todayMaltaDate\(\) !== REPLAY_DAY/);
  assert.match(code, /\.eq\("application_kind", "new"\)/);
  assert.match(code, /\.eq\("status", "activated"\)/);
  assert.match(code, /membership\.welcome_email\.sent/);
  assert.match(code, /sendWelcomePackagesBestEffort\(app\.id\)/);
});
