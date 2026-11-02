import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("End of Day mounts a print bridge that prints only after a fresh successful submission", () => {
  const page = read("app/staff/end-of-day/page.tsx");
  const bridge = read("components/staff/EndOfDayPrintBridge.tsx");

  assert.match(page, /EndOfDayPrintBridge/);
  assert.match(bridge, /End of Day submitted/);
  assert.match(bridge, /MutationObserver/);
  assert.match(bridge, /previousSubmitted/);
  assert.match(bridge, /!previousSubmitted\.current/);
  assert.match(bridge, /window\.print\(\)/);
  assert.match(bridge, /@media print/);
});
