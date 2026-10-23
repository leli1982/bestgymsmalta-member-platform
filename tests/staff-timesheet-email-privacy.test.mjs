import assert from "node:assert/strict";
import test from "node:test";
import { buildStaffTimesheetEmailMessage } from "../lib/staffTimesheetMailer.ts";

const a = { employee: { id: "a", name: "Alex Borg", email: "alex@example.test", homeGymName: "Mosta" }, selectedPeriod: { workedMinutes: 60, payCents: 1000, normalPayCents: 1000, holidayPayCents: 0 } };
const b = { employee: { id: "b", name: "Beth Galea", email: "beth@example.test", homeGymName: "Marsa" }, selectedPeriod: { workedMinutes: 90, payCents: 2000, normalPayCents: 2000, holidayPayCents: 0 } };

test("employee timesheet email is individualized and cannot contain another employee", () => {
  const message = buildStaffTimesheetEmailMessage({ report: a, includeSalary: true, fromDate: "2026-10-01", toDate: "2026-10-31" });
  assert.equal(message.to, "alex@example.test");
  assert.match(message.subject, /Alex Borg/);
  assert.match(message.text, /Alex Borg/);
  assert.doesNotMatch(message.text, new RegExp(b.employee.name));
  assert.doesNotMatch(message.text, new RegExp(b.employee.email));
});

test("salary-hidden employee email body contains no pay values or salary headings", () => {
  const message = buildStaffTimesheetEmailMessage({ report: a, includeSalary: false, fromDate: "2026-10-01", toDate: "2026-10-31" });
  assert.doesNotMatch(message.text, /€|pay|salary|hourly rate/i);
});

test("missing employee email is rejected rather than falling back to another recipient", () => {
  assert.throws(() => buildStaffTimesheetEmailMessage({ report: { ...a, employee: { ...a.employee, email: null } }, includeSalary: true, fromDate: "2026-10-01", toDate: "2026-10-31" }), /email/i);
});
