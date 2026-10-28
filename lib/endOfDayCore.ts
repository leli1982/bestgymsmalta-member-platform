export type EndOfDayPaymentRow = {
  applicationKind: string | null;
  paymentMethod: string | null;
  finalAmountCents: number | null;
  discountCodeSnapshot?: string | null;
  discountReimbursementCentsSnapshot?: number | null;
};

export type EndOfDayBarItem = {
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sortOrder?: number;
};

export type EndOfDayExpense = {
  description: string;
  amountCents: number;
};

export type EndOfDayVoucherBreakdown = {
  voucherCode: string;
  quantity: number;
  reimbursementTotalCents: number;
};

export type EndOfDayTotals = {
  memberships: { cashCents: number; cardCents: number; otherCents: number };
  renewals: { cashCents: number; cardCents: number; otherCents: number };
  vouchers: EndOfDayVoucherBreakdown[];
  voucherReimbursementCents: number;
  barSalesCents: number;
  expensesTotalCents: number;
  grossCents: number;
  dailyTotalCents: number;
};

function cents(value: number | null | undefined) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

export function calculateEndOfDayTotals(
  paymentRows: EndOfDayPaymentRow[],
  barItems: EndOfDayBarItem[],
  expenses: EndOfDayExpense[] = [],
): EndOfDayTotals {
  const memberships = { cashCents: 0, cardCents: 0, otherCents: 0 };
  const renewals = { cashCents: 0, cardCents: 0, otherCents: 0 };
  const vouchers = new Map<string, EndOfDayVoucherBreakdown>();
  let voucherReimbursementCents = 0;

  for (const row of paymentRows) {
    const kind = String(row.applicationKind || "").toLowerCase();
    const method = String(row.paymentMethod || "other").toLowerCase();
    const finalAmount = cents(row.finalAmountCents);
    const target = kind === "renewal" ? renewals : memberships;

    if (method === "cash") target.cashCents += finalAmount;
    else if (method === "card") target.cardCents += finalAmount;
    else target.otherCents += finalAmount;

    if (kind === "new") {
      const reimbursement = cents(row.discountReimbursementCentsSnapshot);
      if (reimbursement > 0) {
        memberships.cardCents += reimbursement;
        voucherReimbursementCents += reimbursement;
        const voucherCode = String(row.discountCodeSnapshot || "VOUCHER").trim() || "VOUCHER";
        const current = vouchers.get(voucherCode) || {
          voucherCode,
          quantity: 0,
          reimbursementTotalCents: 0,
        };
        current.quantity += 1;
        current.reimbursementTotalCents += reimbursement;
        vouchers.set(voucherCode, current);
      }
    }
  }

  const barSalesCents = barItems.reduce((sum, item) => sum + cents(item.lineTotalCents), 0);
  const expensesTotalCents = expenses.reduce((sum, expense) => sum + cents(expense.amountCents), 0);
  const grossCents =
    memberships.cashCents + memberships.cardCents + memberships.otherCents +
    renewals.cashCents + renewals.cardCents + renewals.otherCents +
    barSalesCents;

  return {
    memberships,
    renewals,
    vouchers: Array.from(vouchers.values()).sort((a, b) => a.voucherCode.localeCompare(b.voucherCode)),
    voucherReimbursementCents,
    barSalesCents,
    expensesTotalCents,
    grossCents,
    dailyTotalCents: grossCents - expensesTotalCents,
  };
}
