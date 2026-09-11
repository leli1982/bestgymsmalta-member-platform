export type OrderNotificationSettings = {
  ordersEmail: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
};

export function validateOrderNotificationSettings(input: {
  ordersEmail?: unknown;
  emailEnabled?: unknown;
  pushEnabled?: unknown;
}): OrderNotificationSettings {
  const ordersEmail = String(input.ordersEmail || "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ordersEmail)) {
    throw new Error("A valid email address is required.");
  }

  if (
    typeof input.emailEnabled !== "boolean" ||
    typeof input.pushEnabled !== "boolean"
  ) {
    throw new Error("Notification toggles must be boolean values.");
  }

  return {
    ordersEmail,
    emailEnabled: input.emailEnabled,
    pushEnabled: input.pushEnabled,
  };
}
