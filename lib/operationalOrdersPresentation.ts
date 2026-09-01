import type {
  OperationalOrderStatus,
  OperationalOrderType,
} from "@/lib/operationalOrdersCore";

export function orderTypePresentation(orderType: OperationalOrderType) {
  if (orderType === "sundries") {
    return {
      title: "Sundries Order",
      pluralTitle: "Sundries Orders",
      href: "/staff/sundries",
    } as const;
  }

  return {
    title: "Bar List",
    pluralTitle: "Bar Lists",
    href: "/staff/bar",
  } as const;
}

export function nextOperationalOrderActions(
  status: OperationalOrderStatus
): OperationalOrderStatus[] {
  if (status === "submitted") return ["ordered", "cancelled"];
  if (status === "ordered") return ["completed", "cancelled"];
  return [];
}
