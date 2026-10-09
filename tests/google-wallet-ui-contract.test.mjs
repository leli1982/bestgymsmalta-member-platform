import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function requiredSource(path) {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, "utf8");
}

test("Google Wallet member UI uses the provided official asset unchanged in its own client component", () => {
  const assetPath = "public/google-wallet/add-to-google-wallet.svg";
  const svg = requiredSource(assetPath);
  assert.match(svg, /^<svg width="283" height="50"/);
  assert.match(svg, /fill="#1F1F1F"/);
  assert.match(svg, /fill="#34A853"/);
  assert.match(svg, /fill="#FBBC04"/);
  assert.match(svg, /fill="#EA4335"/);
  assert.match(svg, /stop-color="#4285F4"/);

  const source = requiredSource("components/member/GoogleWalletButton.tsx");
  assert.match(source, /^"use client";/);
  assert.match(source, /const WALLET_ENDPOINT = "\/api\/member\/google-wallet";/);
  assert.match(source, /method: "GET"/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /\/google-wallet\/add-to-google-wallet\.svg/);
  assert.match(source, /aria-label="Add to Google Wallet"/);
  assert.match(source, /submittingRef\.current/);
  assert.match(source, /window\.location\.assign\(data\.saveUrl\)/);
});

test("Google Wallet action is full-card only and client code contains no server credential names", () => {
  const buttonSource = requiredSource("components/member/GoogleWalletButton.tsx");
  const cardSource = requiredSource("components/member/MemberCard.tsx");

  assert.match(cardSource, /import GoogleWalletButton from "@\/components\/member\/GoogleWalletButton";/);
  const homeBranch = cardSource.indexOf('if (variant === "home")');
  const walletRender = cardSource.indexOf("<GoogleWalletButton");
  assert.ok(homeBranch >= 0, "home-card branch must remain explicit");
  assert.ok(walletRender > homeBranch, "Wallet action must render only after the compact home-card early return");

  for (const source of [buttonSource, cardSource]) {
    assert.doesNotMatch(source, /GOOGLE_WALLET_PRIVATE_KEY/);
    assert.doesNotMatch(source, /GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z0-9_]*GOOGLE_WALLET/);
  }
});

test("Google Wallet UI handles unavailable, ineligible and retryable states without custom access logic", () => {
  const source = requiredSource("components/member/GoogleWalletButton.tsx");
  assert.match(source, /available: boolean/);
  assert.match(source, /eligible: boolean/);
  assert.match(source, /reason:/);
  assert.match(source, /if \(!status\.available\) return null;/);
  assert.match(source, /card_missing/);
  assert.match(source, /expired/);
  assert.match(source, /Google Wallet is temporarily unavailable/);
  assert.doesNotMatch(source, /membershipExpiry/);
  assert.doesNotMatch(source, /physicalCardBarcode/);
});
