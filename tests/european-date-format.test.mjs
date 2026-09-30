import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  formatEuropeanDate,
  formatEuropeanDateTime,
  parseEuropeanDate,
} from "../lib/europeanDate.ts";

test("European date helpers always use DD/MM/YYYY", () => {
  assert.equal(formatEuropeanDate("2026-09-30"), "30/09/2026");
  assert.equal(formatEuropeanDate("2026-02-07"), "07/02/2026");
  assert.equal(formatEuropeanDateTime("2026-09-30T08:25:32.878Z"), "30/09/2026 10:25");
  assert.equal(parseEuropeanDate("30/09/2026"), "2026-09-30");
  assert.equal(parseEuropeanDate("29/02/2026"), null);
  assert.equal(parseEuropeanDate("29/02/2028"), "2028-02-29");
});

function sourceFiles(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) result.push(...sourceFiles(full));
    else if (/\.tsx$/.test(name) && !/\.backup/.test(name)) result.push(full);
  }
  return result;
}

test("user-facing pages do not rely on browser-local native date presentation", () => {
  const root = new URL("..", import.meta.url).pathname;
  const allowed = join(root, "components/ui/EuropeanDateInput.tsx");
  const offenders = [...sourceFiles(join(root, "app")), ...sourceFiles(join(root, "components"))]
    .filter((path) => path !== allowed)
    .filter((path) => /type=["']date["']/.test(readFileSync(path, "utf8")));
  assert.deepEqual(offenders, []);
  assert.match(readFileSync(join(root, "app/layout.tsx"), "utf8"), /<html lang="en-GB">/);
});

test("business analytics excludes deleted-member check-ins and keeps small nonzero visit ratios", () => {
  const root = new URL("..", import.meta.url).pathname;
  const route = readFileSync(join(root, "app/api/system/business-analytics/route.ts"), "utf8");
  assert.match(route, /const rawCheckins/);
  assert.match(route, /currentMemberIds/);
  assert.match(route, /rawCheckins\.filter/);
  assert.match(route, /function ratio/);
  assert.match(route, /value > 0 && value < 0\.01/);
});
