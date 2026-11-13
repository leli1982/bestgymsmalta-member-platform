import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const page=fs.readFileSync("components/staff/SuperAdminHome.tsx", "utf8");
test("HU20 TEST recognition is discoverable only with authorised TEST backend",()=>{
 assert.match(page,/HU20 Fingerprint — TEST/);
 assert.match(page,/\/staff\/admin\/staff\/terminals\/enrollment/);
 assert.match(page,/\/api\/system\/staff-hu20\/terminals/);
 assert.match(page,/setHu20TestAvailable\(response\.ok\)/);
 assert.match(page,/section\.href !== "\/staff\/admin\/staff\/terminals\/enrollment" \|\| hu20TestAvailable/);
});
