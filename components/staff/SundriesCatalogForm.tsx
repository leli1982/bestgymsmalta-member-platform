"use client";

import {
  ClipboardList,
  CreditCard,
  Droplets,
  FileText,
  Highlighter,
  NotebookPen,
  PackagePlus,
  Paperclip,
  PenLine,
  Pencil,
  ReceiptText,
  SprayCan,
  StickyNote,
  Trash2,
} from "lucide-react";

function ToiletRollIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3h9c2.4 0 4 3.9 4 9s-1.6 9-4 9H8" />
      <ellipse cx="8" cy="12" rx="5" ry="9" />
      <ellipse cx="8" cy="12" rx="1.5" ry="2.8" />
      <path d="M17 21v-5" />
    </svg>
  );
}

export type SundriesDraftItem = {
  itemName: string;
  quantity: string;
  unit: string;
  notes: string;
  custom?: boolean;
};

export const SUNDRIES_CATALOG = [
  { name: "Toilet paper", icon: ToiletRollIcon },
  { name: "Gym tissues", icon: PackagePlus },
  { name: "Hand soap", icon: Droplets },
  { name: "Floor liquid", icon: SprayCan },
  { name: "Membership forms", icon: FileText },
  { name: "Bar sales", icon: ReceiptText },
  { name: "Membership sales sheet", icon: ClipboardList },
  { name: "Pens", icon: PenLine },
  { name: "Pencils", icon: Pencil },
  { name: "Markers", icon: Highlighter },
  { name: "Membership cards", icon: CreditCard },
  { name: "Staples", icon: Paperclip },
  { name: "Sticky notes", icon: NotebookPen },
] as const;

export function initialSundriesItems(): SundriesDraftItem[] {
  return SUNDRIES_CATALOG.map(({ name }) => ({
    itemName: name,
    quantity: "0",
    unit: "",
    notes: "",
  }));
}

type Props = {
  items: SundriesDraftItem[];
  updateItem: (index: number, field: keyof SundriesDraftItem, value: string) => void;
  addCustom: () => void;
  removeCustom: (index: number) => void;
};

export default function SundriesCatalogForm({
  items,
  updateItem,
  addCustom,
  removeCustom,
}: Props) {
  const standardItems = items.slice(0, SUNDRIES_CATALOG.length);
  const customItems = items.slice(SUNDRIES_CATALOG.length);

  return (
    <div className="mt-5 space-y-6">
      <section aria-label="Predefined sundries items">
        <div className="mb-3">
          <h3 className="text-lg font-black text-zinc-950">Standard sundries</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Set the quantity required for each item. Leave any item at 0 if it is not needed.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUNDRIES_CATALOG.map(({ name, icon: Icon }, index) => (
            <label
              key={name}
              className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition-colors ${
                Number(standardItems[index]?.quantity || 0) > 0
                  ? "border-orange-300 bg-orange-50"
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#ff5a0a] shadow-sm">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-zinc-900">{name}</span>
              <span className="flex shrink-0 flex-col gap-1 text-xs font-bold text-zinc-600">
                Qty
                <input
                  aria-label={`${name} quantity`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={standardItems[index]?.quantity ?? "0"}
                  onChange={(event) => updateItem(index, "quantity", event.target.value)}
                  className="w-20 rounded-xl border border-zinc-300 bg-white px-2 py-2 text-center text-base font-black text-zinc-950 outline-none focus:border-orange-500"
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section aria-label="Additional sundries items" className="rounded-2xl border border-dashed border-orange-300 bg-orange-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Other items</h3>
            <p className="mt-1 text-sm text-zinc-600">Add anything you need that is not in the standard list.</p>
          </div>
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white"
          >
            <PackagePlus className="h-4 w-4" aria-hidden="true" /> Add custom item
          </button>
        </div>
        {customItems.length > 0 && (
          <div className="mt-4 grid gap-3">
            {customItems.map((item, offset) => {
              const index = SUNDRIES_CATALOG.length + offset;
              return (
                <div key={index} className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-[minmax(0,2fr)_90px_minmax(0,1fr)_auto] sm:items-end">
                  <label className="text-xs font-bold text-zinc-600">
                    Item name
                    <input
                      aria-label={`Custom item ${offset + 1} name`}
                      value={item.itemName}
                      onChange={(event) => updateItem(index, "itemName", event.target.value)}
                      placeholder="e.g. Cleaning cloths"
                      maxLength={120}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950"
                    />
                  </label>
                  <label className="text-xs font-bold text-zinc-600">
                    Qty
                    <input
                      aria-label={`Custom item ${offset + 1} quantity`}
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-center text-sm font-black text-zinc-950"
                    />
                  </label>
                  <label className="text-xs font-bold text-zinc-600">
                    Notes (optional)
                    <input
                      aria-label={`Custom item ${offset + 1} notes`}
                      value={item.notes}
                      onChange={(event) => updateItem(index, "notes", event.target.value)}
                      placeholder="Size, brand…"
                      maxLength={250}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCustom(index)}
                    aria-label={`Remove custom item ${offset + 1}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> <span className="sm:hidden">Remove</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
