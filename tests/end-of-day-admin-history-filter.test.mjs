import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/api/system/end-of-day/route.ts", "utf8");
const adminSource = readFileSync("components/staff/EndOfDayAdminPage.tsx", "utf8");

test("Super Admin End of Day supports optional exact-date and gym history filters", () => {
  assert.match(routeSource, /searchParams\.get\("businessDate"\)/);
  assert.match(routeSource, /isValidCalendarDate\(businessDate\)/);
  assert.match(routeSource, /query = query\.eq\("business_date", businessDate\)/);

  assert.match(adminSource, /useState\(\(\) => todayMaltaDate\(\)\)/);
  assert.match(adminSource, /End of Day date filter/);
  assert.match(adminSource, /query\.set\("businessDate", filterBusinessDate\)/);
  assert.match(adminSource, /Clear filters/);
});
