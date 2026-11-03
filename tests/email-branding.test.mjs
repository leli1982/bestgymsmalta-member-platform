import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bgmEmailFooterHtml, bgmEmailFooterText, BGM_CONTACT_EMAIL, BGM_LOGO_URL } from "../lib/emailBranding.ts";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";

const mailer = readFileSync(new URL("../lib/welcomeMailer.ts", import.meta.url), "utf8");

test("transactional email footer includes official logo, do-not-reply notice and contact", () => {
  const html = bgmEmailFooterHtml();
  const text = bgmEmailFooterText();
  assert.equal(BGM_CONTACT_EMAIL, "info@bestgymsmalta.com");
  assert.match(BGM_LOGO_URL, /\/brand\/bgm-logo-white-horizontal\.png$/);
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
    assert.match(message.html, /bgm-logo-white-horizontal\.png/);
    assert.match(message.text, /This is an automated email/);
  }
});

test("legacy activation email uses the shared footer in both message formats", () => {
  assert.match(mailer, /bgmEmailFooterText\(\)/);
  assert.match(mailer, /bgmEmailFooterHtml\(\)/);
  assert.match(mailer, /sendLegacyActivationConfirmationEmail/);
});
