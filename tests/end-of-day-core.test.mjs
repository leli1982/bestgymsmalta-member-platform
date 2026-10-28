import test from "node:test";
import assert from "node:assert/strict";
import { calculateEndOfDayTotals } from "../lib/endOfDayCore.ts";

test("student voucher reimbursement is card income for new memberships without double-counting gross", () => {
  const rows = [1, 2, 3].map(() => ({
    applicationKind: "new",
    paymentMethod: "card",
    finalAmountCents: 0,
    discountCodeSnapshot: "STUDENT VOUCHER",
    discountReimbursementCentsSnapshot: 30000,
  }));
  const totals = calculateEndOfDayTotals(rows, [], []);
  assert.equal(totals.memberships.cardCents, 90000);
  assert.equal(totals.voucherReimbursementCents, 90000);
  assert.deepEqual(totals.vouchers, [{
    voucherCode: "STUDENT VOUCHER",
    quantity: 3,
    reimbursementTotalCents: 90000,
  }]);
  assert.equal(totals.grossCents, 90000, "voucher reimbursement is already inside membership Card sales");
});

test("voucher reimbursement never flows into renewals", () => {
  const totals = calculateEndOfDayTotals([{
    applicationKind: "renewal",
    paymentMethod: "card",
    finalAmountCents: 5000,
    discountCodeSnapshot: "STUDENT VOUCHER",
    discountReimbursementCentsSnapshot: 30000,
  }], [], []);
  assert.equal(totals.renewals.cardCents, 5000);
  assert.equal(totals.voucherReimbursementCents, 0);
  assert.equal(totals.vouchers.length, 0);
});

test("cash/card/other, bar and expenses combine into final End of Day total", () => {
  const totals = calculateEndOfDayTotals([
    { applicationKind: "new", paymentMethod: "cash", finalAmountCents: 7900 },
    { applicationKind: "new", paymentMethod: "other", finalAmountCents: 1000 },
    { applicationKind: "renewal", paymentMethod: "card", finalAmountCents: 5000 },
  ], [
    { itemName: "Water", quantity: 2, unitPriceCents: 150, lineTotalCents: 300 },
  ], [
    { description: "Cleaning", amountCents: 900 },
  ]);
  assert.equal(totals.memberships.cashCents, 7900);
  assert.equal(totals.memberships.otherCents, 1000);
  assert.equal(totals.renewals.cardCents, 5000);
  assert.equal(totals.barSalesCents, 300);
  assert.equal(totals.grossCents, 14200);
  assert.equal(totals.dailyTotalCents, 13300);
});
