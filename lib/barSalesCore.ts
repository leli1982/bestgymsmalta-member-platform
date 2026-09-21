export type BarCatalogItem = {
  id: string;
  name: string;
  priceCents: number | null;
  isOther: boolean;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type BarDraftEntry = {
  catalogItemId: string;
  quantity: number;
  expectedPriceCents?: number | null;
  otherName?: string;
  otherPriceCents?: number | null;
};

export type BarSalesSnapshotItem = {
  catalogItemId: string;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  unit: null;
  notes: null;
};

export const BAR_MAX_PRICE_CENTS = 100_000_000;
export const BAR_MAX_TOTAL_CENTS = 2_000_000_000;
export const BAR_MAX_QUANTITY = 10000;

export function parseEuroCents(value: unknown): number | null {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [euros, cents = ""] = value.trim().split(".");
  const amount = Number(euros) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= BAR_MAX_PRICE_CENTS ? amount : null;
}

export function formatBarEuro(amountCents: number) {
  return new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" })
    .format(amountCents / 100);
}

export function snapshotBarSale(
  rawEntries: unknown,
  activeCatalog: BarCatalogItem[],
): { items: BarSalesSnapshotItem[]; totalCents: number; error: null } |
   { items: []; totalCents: 0; error: string } {
  const invalid = (message: string) => ({ items: [] as [], totalCents: 0 as const, error: message });
  if (!Array.isArray(rawEntries) || rawEntries.length > 75) return invalid("Provide a valid Bar List.");

  const byId = new Map(activeCatalog.filter((item) => item.active).map((item) => [item.id, item]));
  const usedStandard = new Set<string>();
  const items: BarSalesSnapshotItem[] = [];
  let totalCents = 0;

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") return invalid("An item in this Bar List is invalid.");
    const entry = raw as Record<string, unknown>;
    const id = String(entry.catalogItemId ?? "").trim();
    const item = byId.get(id);
    if (!item) return invalid("The Bar List has changed. Refresh the catalogue and review your quantities.");
    const quantity = entry.quantity;
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) ||
        quantity < 0 || quantity > BAR_MAX_QUANTITY) {
      return invalid("Bar quantities must be whole numbers between 0 and 10,000.");
    }
    if (quantity === 0) continue;

    let name = item.name;
    let unitPriceCents: number;
    if (item.isOther) {
      name = String(entry.otherName ?? "").trim();
      if (!name || name.length > 120) return invalid("Name every Others item with a quantity above zero.");
      if (typeof entry.otherPriceCents !== "number" ||
          !Number.isSafeInteger(entry.otherPriceCents) ||
          entry.otherPriceCents < 0 || entry.otherPriceCents > BAR_MAX_PRICE_CENTS) {
        return invalid("Enter a valid unit price for every Others item.");
      }
      unitPriceCents = entry.otherPriceCents;
    } else {
      if (usedStandard.has(id)) return invalid("A catalogue item may only appear once in a Bar List.");
      usedStandard.add(id);
      if (typeof item.priceCents !== "number" || !Number.isSafeInteger(item.priceCents)) {
        return invalid("A Bar item is missing its published price.");
      }
      if (entry.expectedPriceCents !== item.priceCents) {
        return invalid("Bar prices changed while you were preparing this list. Refresh to review the new prices.");
      }
      unitPriceCents = item.priceCents;
    }
    const lineTotalCents = unitPriceCents * quantity;
    if (!Number.isSafeInteger(lineTotalCents) || lineTotalCents > BAR_MAX_TOTAL_CENTS ||
        totalCents + lineTotalCents > BAR_MAX_TOTAL_CENTS) {
      return invalid("This Bar List total exceeds the supported amount.");
    }
    totalCents += lineTotalCents;
    items.push({ catalogItemId: id, itemName: name, quantity,
      unitPriceCents, lineTotalCents, unit: null, notes: null });
  }

  if (!items.length) return invalid("Add a quantity to at least one Bar item.");
  return { items, totalCents, error: null };
}
