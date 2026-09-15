// Batch 2 contract: light Passport surfaces and canvas-first Story editor chrome with dark exported artwork.
// Canvas-first checkpoint: keep the story visible while tools open in a compact dock/sheet flow.
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

test("Story Creator is canvas-first with an Instagram-style tool dock and overlay sheet", () => {
  const story = readFileSync(storyPath, "utf8");

  assert.match(story, /type StoryTool = ["']photo["'] \| ["']text["'] \| ["']stickers["'] \| ["']templates["']/);
  assert.match(story, /const \[activeTool, setActiveTool\] = useState<StoryTool \| null>\(null\)/);
  assert.match(story, /data-story-editor=["']canvas-first["']/);
  assert.match(story, /data-story-tool-dock/);
  assert.match(story, /data-story-tool=["']photo["']/);
  assert.match(story, /data-story-tool=["']text["']/);
  assert.match(story, /data-story-tool=["']stickers["']/);
  assert.match(story, /data-story-tool=["']templates["']/);
  assert.match(story, /data-story-tool-sheet=\{activeTool\}/);
  assert.match(story, /fixed bottom-\[calc\(96px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(story, /h-\[48svh\]/);
});
