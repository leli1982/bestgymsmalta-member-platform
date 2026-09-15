import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const gymsPagePath = join(root, "components/gyms/LiveGymsPage.tsx");

test("gym finder opens with a compact network hero above search", () => {
  const page = readFileSync(gymsPagePath, "utf8");

  assert.match(page, /data-gym-hero=["']network["']/);
  assert.match(page, /\/visuals\/gyms\.jpg/);
  assert.match(page, /Find your gym\./i);
  assert.match(page, /One membership\.\s*Train across Malta\./i);
  assert.match(page, /active gyms/i);
  assert.match(page, /locations/i);

  const heroIndex = page.indexOf('data-gym-hero="network"');
  const searchIndex = page.indexOf('id="gym-search"');
  assert.ok(heroIndex >= 0 && searchIndex > heroIndex, "search must follow the hero");
});
