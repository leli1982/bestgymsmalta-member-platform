import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bgmAppAccessHtml, bgmAppAccessText, bgmEmailFooterHtml, bgmEmailFooterText, BGM_CONTACT_EMAIL, BGM_LOGO_URL } from "../lib/emailBranding.ts";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";

const mailer = readFileSync(new URL("../lib/welcomeMailer.ts", import.meta.url), "utf8");

test("transactional email footer includes official logo, do-not-reply notice and contact", () => {
  const html = bgmEmailFooterHtml();
  const text = bgmEmailFooterText();
  assert.equal(BGM_CONTACT_EMAIL, "info@bestgymsmalta.com");
  assert.match(BGM_LOGO_URL, /\/email\/bgm-logo-horizontal-black\.png$/);
  assert.match(html, /alt="BestGymsMalta"/);
  assert.match(html, /This is an automated email\. Please do not reply\./);
  assert.match(html, /mailto:info@bestgymsmalta\.com/);
  assert.match(text, /Please do not reply/);
  assert.match(text, /info@bestgymsmalta\.com/);
});

test("enrollment and renewal HTML and plaintext include footer", () => {
  for (const applicationKind of ["new", "renewal"]) {
    const message = buildWelcomeEmail({
      memberName: "Example",
      memberNumber: "BGM0000123",
      appUrl: "https://example.test/login",
      applicationKind,
      declarations: { gymRules: { body: "Rules" }, health: { body: "Health" }, privacy: { body: "Privacy" } },
    });
    assert.match(message.html, /mailto:info@bestgymsmalta\.com/);
    assert.match(message.html, /bgm-logo-horizontal-black\.png/);
    assert.match(message.text, /This is an automated email/);
  }
});

test("legacy activation email uses the shared footer in both message formats", () => {
  assert.match(mailer, /bgmEmailFooterText\(\)/);
  assert.match(mailer, /bgmEmailFooterHtml\(\)/);
  assert.match(mailer, /sendLegacyActivationConfirmationEmail/);
});

test("CTA uses a button, fallback link and short Android and iPhone installation instructions", () => {
  const html = bgmAppAccessHtml("https://example.test/login?x=1&y=2");
  const plain = bgmAppAccessText("https://example.test/login");
  assert.match(html, /Open Member App/);
  assert.match(html, /role="presentation"/);
  assert.match(html, /example\.test\/login\?x=1&amp;y=2/);
  assert.match(html, /Button not working/);
  assert.match(html, /Android:/);
  assert.match(html, /Chrome/);
  assert.match(html, /iPhone:/);
  assert.match(html, /Safari/);
  assert.match(html, /Add to Home Screen/);
  assert.match(plain, /Add to Home screen/);
  assert.match(plain, /Open Member App/);
});

test("new and renewal emails both include the app button and installation instructions", () => {
  for (const applicationKind of ["new", "renewal"]) {
    const msg = buildWelcomeEmail({ memberName: "Test", memberNumber: "BGM00007",
      appUrl: "https://example.test/login", applicationKind,
      declarations: { gymRules: { body: "Rules" }, health: { body: "Health" }, privacy: { body: "Privacy" } } });
    assert.match(msg.html, /Open Member App/);
    assert.match(msg.html, /Add to Home Screen/);
    assert.match(msg.text, /Android:/);
    assert.match(msg.text, /iPhone:/);
  }
});
test("legacy mailer shares the button and instructions", () => {
  assert.match(mailer, /bgmAppAccessHtml\(appUrl\)/);
  assert.match(mailer, /bgmAppAccessText\(appUrl\)/);
});
