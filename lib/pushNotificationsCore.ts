export type OrderPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export function buildOrderPushPayload(input: {
  orderType: "sundries" | "bar";
  orderId: string;
  gymName: string;
  staffName: string;
  itemCount: number;
}): OrderPushPayload {
  const title =
    input.orderType === "bar" ? "New Bar List" : "New Sundries Order";
  const count = Math.max(0, Number(input.itemCount) || 0);
  const itemWord = count === 1 ? "item" : "items";

  return {
    title,
    body: `${input.gymName} · ${input.staffName} · ${count} ${itemWord}`,
    url: `/staff/${input.orderType === "bar" ? "bar" : "sundries"}?order=${encodeURIComponent(
      input.orderId
    )}`,
    tag: `bgm-order-${input.orderId}`,
  };
}

export function resolveVapidConfig(env: {
  BGM_VAPID_PUBLIC_KEY?: string;
  BGM_VAPID_PRIVATE_KEY?: string;
  BGM_VAPID_SUBJECT?: string;
}) {
  const publicKey = String(env.BGM_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(env.BGM_VAPID_PRIVATE_KEY || "").trim();
  const subject = String(env.BGM_VAPID_SUBJECT || "").trim();

  if (!publicKey || !privateKey || !subject) return null;

  return { publicKey, privateKey, subject };
}
