import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Staff Help content covers every released regular-staff workflow", () => {
  const source = read("lib/staffHelpContent.ts");
  for (const id of ["scan-member", "find-member", "new-member", "waiting-applications", "renew-membership", "reception-cards", "sundries", "bar", "end-of-day"]) {
    assert.match(source, new RegExp(`id:\\s*[\"']${id}[\"']`));
  }
});

test("Staff Help search includes practical reception synonyms", () => {
  const source = read("lib/staffHelpContent.ts");
  for (const keyword of ["lost card", "stolen card", "expired", "photo", "voucher", "cash", "replacement card"]) {
    assert.match(source.toLowerCase(), new RegExp(keyword.replace(" ", "\\s+")));
  }
});

test("Bar and End of Day Help preserve the approved safety rules", () => {
  const source = read("lib/staffHelpContent.ts");
  assert.match(source, /There is no Send Bar List button/i);
  assert.match(source, /auto-?save/i);
  assert.match(source, /locks? that day.?s Bar sheet/i);
});

test("Help content defines route context for regular Staff pages only", () => {
  const source = read("lib/staffHelpContent.ts");
  assert.match(source, /getContextStaffHelpTopic/);
  assert.match(source, /\/staff\/bar/);
  assert.match(source, /\/staff\/end-of-day/);
  assert.match(source, /\/staff\/reception/);
  assert.doesNotMatch(source, /super admin help/i);
});
