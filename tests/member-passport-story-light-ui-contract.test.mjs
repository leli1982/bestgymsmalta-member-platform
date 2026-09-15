import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const passportPagePath = join(root, "app/passport/page.tsx");
const passportPath = join(root, "components/passport/LivePassportPage.tsx");
const storyPagePath = join(root, "app/story/page.tsx");
const storyPath = join(root, "components/story/StoryCreator.tsx");

test("Passport and Story Creator use the approved light member shell", () => {
  const passportPage = readFileSync(passportPagePath, "utf8");
  const storyPage = readFileSync(storyPagePath, "utf8");

  assert.match(passportPage, /<AppShell\s+theme=["']light["']/);
  assert.match(storyPage, /<AppShell\s+theme=["']light["']/);
  assert.match(storyPage, /text-zinc-950/);
  assert.match(storyPage, /text-zinc-500/);
});

test("Passport keeps its live stamp and check-in behavior on light working surfaces", () => {
  const passport = readFileSync(passportPath, "utf8");

  assert.match(passport, /data-member-surface=["']passport-light["']/);
  assert.match(passport, /border-zinc-200/);
  assert.match(passport, /bg-white/);
  assert.match(passport, /text-zinc-950/);
  assert.match(passport, /\/visuals\/passport\.jpg/);
  assert.match(passport, /\/api\/gyms/);
  assert.match(passport, /\/api\/checkins\?memberId=/);
  assert.match(passport, /\/scan-gym-qr/);
  assert.match(passport, /style=\{\{ width: `\$\{completion\}%` \}\}/);
});

test("Story Creator uses light editor chrome while preserving the dark 9 by 16 story output", () => {
  const story = readFileSync(storyPath, "utf8");

  assert.match(story, /data-member-surface=["']story-light["']/);
  assert.match(story, /border-zinc-200/);
  assert.match(story, /bg-white/);
  assert.match(story, /text-zinc-950/);
  assert.match(story, /aspect-\[9\/16\]/);
  assert.match(story, /renderStoryBlob/);
  assert.match(story, /navigator\.share/);
  assert.match(story, /capture=["']environment["']/);
  assert.match(story, /bestgymsmalta-story\.png/);
  assert.match(story, /ctx\.fillStyle = ["']#050505["']/);
  assert.match(story, /ctx\.strokeStyle = ["']rgba\(252,180,21,0\.78\)["']/);
});
