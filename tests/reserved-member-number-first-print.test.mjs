import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(p, "utf8");
const sql = read("supabase/migrations/20261119_090000_reserve_member_number_before_first_print.sql");
const printRoute = read("app/api/system/members/applications/[applicationId]/print/route.ts");
const reserveRoute = read("app/api/system/members/applications/[applicationId]/reserve-numbers/route.ts");
const loader = read("lib/printableMembershipApplication.ts");
const page = read("components/staff/StaffApplicationPrint.tsx");
const sheet = read("components/staff/MembershipA4Sheet.tsx");

test("reservation is a distinct durable, unique member number assigned only to unactivated new people", () => {
  assert.match(sql, /add column if not exists reserved_member_number text/);
  assert.match(sql, /create unique index if not exists bgm_app_member_reserved_number_unique/);
  assert.match(sql, /old\.reserved_member_number is not null/);
  assert.match(sql, /new\.reserved_member_number is distinct from old\.reserved_member_number/);
  assert.match(sql, /A printed BGM member number cannot be changed or released/);
  assert.match(sql, /v_app\.status = 'activated' or v_app\.application_kind <> 'new'/);
  assert.match(sql, /v_app\.status not in \('submitted','awaiting_payment'\)/);
  assert.match(sql, /v_participant\.existing_member_id is null and/);
  assert.match(sql, /v_participant\.reserved_member_number is null/);
  assert.match(sql, /v_number := public\.bgm_next_member_number\(\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /bgm_member_number_reserved|member_number_reserved/);
  assert.doesNotMatch(sql, /set last_issued\s*=\s*0|delete from public\.bgm_member_number_state/);
});

test("reserved number is consumed exactly at final activation, with old applications supported", () => {
  assert.match(sql, /v_member_number := coalesce\(v_participant\.reserved_member_number, public\.bgm_next_member_number\(\)\)/);
  assert.match(sql, /insert into public\.bgm_members\(member_number/);
  assert.match(sql, /if v_application\.status='activated' then/);
  assert.match(sql, /v_participant\.renewal_card_action not in \('keep','replace'\)/);
  assert.match(sql, /discount_amount_cents/);
  assert.match(sql, /membership\.activate/);
  assert.match(sql, /revoke all on function public\.bgm_reserve_membership_application_numbers\(uuid,uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.bgm_reserve_membership_application_numbers\(uuid,uuid\)[\s\S]*to service_role/);
});

test("staff preparation is authenticated, server-owned and prints only after reservation", () => {
  assert.match(reserveRoute, /export async function POST/);
  assert.match(reserveRoute, /requireSystemPermission\(request, "members.create"\)/);
  assert.match(reserveRoute, /bgm_reserve_membership_application_numbers/);
  assert.match(reserveRoute, /p_system_user_id: auth\.context\.systemUserId/);
  assert.doesNotMatch(reserveRoute, /memberNumber\s*[:=]\s*body\.|request\.json\(\)/);
  assert.match(page, /reserve-numbers/);
  assert.ok(page.indexOf('reserve-numbers') < page.indexOf('/print`'), "reservation must happen before print GET");
  assert.match(page, /A BGM member number is missing. Do not print this form/);
  assert.match(printRoute, /loadPrintableMembershipApplication\(applicationId\)/);
  assert.match(loader, /reserved_member_number/);
  assert.match(loader, /member\?\.member_number \|\| \(!application\.activated_at/);
  assert.match(sheet, /BGM member number \(reserved\)/);
  assert.doesNotMatch(sheet, /Assigned on activation/);
});

test("reservation is never guessed by scanning current max member number", () => {
  assert.doesNotMatch(sql, /select max\(|max\(member_number\)/i);
  assert.match(sql, /update public\.bgm_membership_application_members[\s\S]*set reserved_member_number=v_number/);
  assert.match(sql, /v_app\.application_source='tablet' and v_app\.reviewed_by_system_user_id is null/);
  assert.match(sql, /v_user\.gym_id is distinct from v_app\.enrollment_gym_id/);
  assert.match(sql, /jsonb_build_object\('newReservations',v_new_count/);
});
