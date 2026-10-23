import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const splash = readFileSync(new URL("../components/SplashScreen.tsx", import.meta.url), "utf8");

test("splash screen keeps the dedicated round BGM logo", () => {
  assert.match(splash, /src="\/bgm-logo-round\.png"/);
  assert.doesNotMatch(splash, /src="\/bgm-logo\.png"/);
});
