import type { OperationalOrderItem, OperationalOrderType } from "@/lib/operationalOrdersCore";

type OperationalOrderEmailInput = {
  orderType: OperationalOrderType;
  orderId: string;
  gymName: string;
  staffName: string;
  notes?: string | null;
  items: OperationalOrderItem[];
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function titleForType(orderType: OperationalOrderType) {
  return orderType === "sundries" ? "Sundries" : "Bar";
}

export function buildOperationalOrderEmail(input: OperationalOrderEmailInput) {
  const title = titleForType(input.orderType);
  const subject = `${title} order - ${input.gymName}`;

  const textItems = input.items
    .map((item, index) => {
      const unit = item.unit ? ` ${item.unit}` : "";
      const notes = item.notes ? ` - ${item.notes}` : "";
      return `${index + 1}. ${item.itemName}: ${item.quantity}${unit}${notes}`;
    })
    .join("\n");

  const text = [
    `${title} order`,
    `Gym: ${input.gymName}`,
    `Staff Name: ${input.staffName}`,
    `Order ID: ${input.orderId}`,
    "",
    textItems,
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
      return `<li style="margin-bottom:10px;"><strong>${escapeHtml(item.itemName)}</strong>: ${escapeHtml(item.quantity)}${unit}${notes}</li>`;
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
      </table>
      <h3>Items</h3>
      <ol style="padding-left:22px;">${htmlItems}</ol>
      ${input.notes ? `<h3>Notes</h3><p>${escapeHtml(input.notes)}</p>` : ""}
      <p style="color:#777;font-size:12px;margin-top:24px;">BestGymsMalta</p>
    </div>
  `;

  return { subject, text, html };
}
