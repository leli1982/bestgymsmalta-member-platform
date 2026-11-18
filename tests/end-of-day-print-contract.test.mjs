import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("End of Day mounts a print bridge that prints only after a fresh successful submission", () => {
  const page = read("app/staff/end-of-day/page.tsx");
  const bridge = read("components/staff/EndOfDayPrintBridge.tsx");

  assert.match(page, /EndOfDayPrintBridge/);
  const flow = read("components/staff/EndOfDayPage.tsx");
  assert.match(bridge, /bgm:end-of-day-submitted/);
  assert.match(bridge, /window\.addEventListener/);
  assert.match(bridge, /window\.print\(\)/);
  assert.doesNotMatch(bridge, /MutationObserver/);
  assert.match(flow, /!response\.ok \|\| !payload\.report\?\.id/);
  assert.match(flow, /window\.dispatchEvent\(new Event\("bgm:end-of-day-submitted"\)\)/);
  assert.match(bridge, /@media print/);
});
