import type { OperationalOrderItem, OperationalOrderType } from "@/lib/operationalOrdersCore";

type OperationalOrderEmailInput = {
  orderType: OperationalOrderType;
  orderId: string;
  gymName: string;
  staffName: string;
  notes?: string | null;
  items: (OperationalOrderItem & { unitPriceCents?: number; lineTotalCents?: number })[];
  barBusinessDate?: string;
  barTotalCents?: number | null;
  barCashFoundCents?: number | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function euros(cents: number) {
  return new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function titleForType(orderType: OperationalOrderType) {
  return orderType === "sundries" ? "Sundries" : "Bar";
}

export function buildOperationalOrderEmail(input: OperationalOrderEmailInput) {
  const title = titleForType(input.orderType);
  const subject = input.orderType === "bar"
    ? `Bar sales ${input.barBusinessDate || ""} - ${input.gymName}`
    : `${title} order - ${input.gymName}`;

  const textItems = input.items
    .map((item, index) => {
      const unit = item.unit ? ` ${item.unit}` : "";
      const notes = item.notes ? ` - ${item.notes}` : "";
      const amount = input.orderType === "bar" && item.unitPriceCents != null
        ? ` × ${euros(item.unitPriceCents)} = ${euros(item.lineTotalCents || 0)}`
        : "";
      return `${index + 1}. ${item.itemName}: ${item.quantity}${unit}${amount}${notes}`;
    })
    .join("\n");

  const text = [
    `${title} order`,
    `Gym: ${input.gymName}`,
    `Staff Name: ${input.staffName}`,
    `Order ID: ${input.orderId}`,
    ...(input.orderType === "bar" ? [`Business date (Malta): ${input.barBusinessDate || "—"}`] : []),
    "",
    textItems,
    ...(input.orderType === "bar" && input.barTotalCents != null
      ? [`TOTAL SALES: ${euros(input.barTotalCents)}`] : []),
    ...(input.orderType === "bar" && input.barCashFoundCents != null
      ? [`TOTAL CASH FOUND: ${euros(input.barCashFoundCents)}`] : []),
    input.notes ? `\nNotes: ${input.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const htmlItems = input.items
    .map((item) => {
      const unit = item.unit ? ` ${escapeHtml(item.unit)}` : "";
      const notes = item.notes
        ? `<div style="color:#666;font-size:13px;margin-top:2px;">${escapeHtml(item.notes)}</div>`
        : "";
      const amount = input.orderType === "bar" && item.unitPriceCents != null
        ? ` × ${escapeHtml(euros(item.unitPriceCents))} = <strong>${escapeHtml(euros(item.lineTotalCents || 0))}</strong>`
        : "";
      return `<li style="margin-bottom:10px;"><strong>${escapeHtml(item.itemName)}</strong>: ${escapeHtml(item.quantity)}${unit}${amount}${notes}</li>`;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:640px;">
      <h2 style="margin-bottom:6px;">${title} order</h2>
      <p style="margin-top:0;color:#555;">BestGymsMalta operational order</p>
      <table style="border-collapse:collapse;margin:18px 0;width:100%;">
        <tr><td style="padding:6px 0;font-weight:bold;">Gym</td><td style="padding:6px 0;">${escapeHtml(input.gymName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:bold;">Staff Name</td><td style="padding:6px 0;">${escapeHtml(input.staffName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:bold;">Order ID</td><td style="padding:6px 0;">${escapeHtml(input.orderId)}</td></tr>
        ${input.orderType === "bar" ? `<tr><td style="padding:6px 0;font-weight:bold;">Business date</td><td>${escapeHtml(input.barBusinessDate || "—")}</td></tr>` : ""}
      </table>
      <h3>Items</h3>
      <ol style="padding-left:22px;">${htmlItems}</ol>
      ${input.orderType === "bar" && input.barTotalCents != null
        ? `<p style="font-size:20px;font-weight:bold;">TOTAL SALES: ${escapeHtml(euros(input.barTotalCents))}</p>` : ""}
      ${input.orderType === "bar" && input.barCashFoundCents != null
        ? `<p style="font-size:18px;font-weight:bold;">TOTAL CASH FOUND: ${escapeHtml(euros(input.barCashFoundCents))}</p>` : ""}
      ${input.notes ? `<h3>Notes</h3><p>${escapeHtml(input.notes)}</p>` : ""}
      <p style="color:#777;font-size:12px;margin-top:24px;">BestGymsMalta</p>
    </div>
  `;

  return { subject, text, html };
}
