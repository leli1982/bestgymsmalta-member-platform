import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Staff Help content covers every released regular-staff workflow", () => {
  const source = read("lib/staffHelpContent.ts");
  for (const id of ["scan-member", "find-member", "membership-access", "new-member", "waiting-applications", "renew-membership", "reception-cards", "sundries", "bar", "end-of-day"]) {
    assert.match(source, new RegExp(`id:\\s*[\"']${id}[\"']`));
  }
});

test("Staff Help search includes practical reception synonyms", () => {
  const source = read("lib/staffHelpContent.ts");
  for (const keyword of ["lost card", "stolen card", "expired", "photo", "voucher", "cash", "replacement card", "single gym", "all access"]) {
    assert.match(source.toLowerCase(), new RegExp(keyword.replace(" ", "\\s+")));
  }
});

test("Single Gym Help explains selection and scanner enforcement", () => {
  const source = read("lib/staffHelpContent.ts");
  assert.match(source, /All Access/i);
  assert.match(source, /Single Gym/i);
  assert.match(source, /current access is preselected/i);
  assert.match(source, /denied at any other gym/i);
  assert.match(source, /offline cached/i);
  assert.match(source, /no live check-in/i);
});

test("Bar and End of Day Help use EOD submission, not midnight, as the reset", () => {
  const source = read("lib/staffHelpContent.ts");
  assert.match(source, /There is no Send Bar List button/i);
  assert.match(source, /auto-?save/i);
  assert.match(source, /carries across midnight/i);
  assert.match(source, /midnight does not reset/i);
  assert.match(source, /only.*End of Day.*submit/i);
  assert.match(source, /sales.*after.*End of Day.*next End of Day/i);
  assert.doesNotMatch(source, /locks? that day.?s Bar sheet/i);
});

test("Staff Bar and End of Day screens do not describe the open financial shift as today", () => {
  const barPage = read("components/staff/BarSalesPage.tsx");
  const eodPage = read("components/staff/EndOfDayPage.tsx");

  assert.doesNotMatch(barPage, /Bar total for today/i);
  assert.match(barPage, /since last End of Day/i);
  assert.doesNotMatch(eodPage, /calculated automatically from today.?s saved activity/i);
  assert.match(eodPage, /since the previous End of Day/i);
});

test("Help content defines route context for regular Staff pages only", () => {
  const source = read("lib/staffHelpContent.ts");
  assert.match(source, /getContextStaffHelpTopic/);
  assert.match(source, /\/staff\/bar/);
  assert.match(source, /\/staff\/end-of-day/);
  assert.match(source, /\/staff\/reception/);
  assert.doesNotMatch(source, /super admin help/i);
});
