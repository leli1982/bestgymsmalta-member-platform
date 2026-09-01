import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalOrderEmail } from "../lib/operationalOrderEmail.ts";

test("builds a clear sundries order email and escapes user-entered HTML", () => {
  const email = buildOperationalOrderEmail({
    orderType: "sundries",
    orderId: "order-123",
    gymName: "Birkirkara Fitness",
    staffName: "Maria <script>alert(1)</script> Borg",
    notes: "Please deliver <b>soon</b>",
    items: [
      { itemName: "Paper Towels", quantity: 4, unit: "rolls", notes: null },
      { itemName: "Cleaner <strong>5L</strong>", quantity: 2, unit: null, notes: "Floor" },
    ],
  });

  assert.match(email.subject, /Sundries order/i);
  assert.match(email.subject, /Birkirkara Fitness/i);
  assert.match(email.text, /Maria <script>alert\(1\)<\/script> Borg/);
  assert.match(email.text, /Paper Towels/);
  assert.doesNotMatch(email.html, /<script>/i);
  assert.doesNotMatch(email.html, /<strong>5L<\/strong>/i);
  assert.match(email.html, /&lt;script&gt;/i);
  assert.match(email.html, /&lt;strong&gt;5L&lt;\/strong&gt;/i);
});
