"use client";

import {
  CreditCard,
  Highlighter,
  PackagePlus,
  PenLine,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";

type PictureProps = { className?: string };

function ItemPicture({ className, children }: PictureProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none"
      stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function ToiletRollIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M22 11h22c6 0 10 9 10 21s-4 21-10 21H22" />
    <ellipse cx="22" cy="32" rx="12" ry="21" />
    <ellipse cx="22" cy="32" rx="4" ry="7" />
    <path d="M44 53v7h-13" />
  </ItemPicture>;
}

function TissueBoxIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M20 30c-4-6-4-13 3-16 7 0 10 8 10 11 5-9 15-11 15-2 0 3-2 6-4 8" />
    <rect x="6" y="30" width="52" height="25" rx="4" />
    <path d="M21 36h22M14 43h8m20 0h8" />
  </ItemPicture>;
}

function SoapDispenserIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M25 19V12h12v7M31 12V7h17v5M48 12h5" />
    <rect x="16" y="19" width="32" height="38" rx="7" />
    <path d="M25 39c0-4 7-11 7-11s7 7 7 11a7 7 0 0 1-14 0Z" />
  </ItemPicture>;
}

function FloorCleanerIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M23 7h17v9H23zM26 16v6l-8 8v24c0 3 2 4 5 4h23c3 0 5-2 5-5V30l-8-8v-6" />
    <path d="M20 35h29M27 41l5 6 5-6m-5 6v6" />
    <path d="M7 55h8m38 0h5" />
  </ItemPicture>;
}

function MembershipFormsIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M15 6h26l9 9v43H15zM41 6v10h9" />
    <circle cx="28" cy="26" r="5" />
    <path d="M20 39c2-7 14-7 16 0M20 46h24M20 51h17" />
  </ItemPicture>;
}

function BarSalesIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M11 6h42v51l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-7 4z" />
    <path d="M23 18h15l-2 17H25zM26 15h9M38 22h5c4 0 4 8-5 8M25 42h14M25 47h9" />
  </ItemPicture>;
}

function MembershipSalesSheetIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M12 6h40v52H12z" />
    <rect x="19" y="14" width="26" height="19" rx="2" />
    <circle cx="27" cy="22" r="3" />
    <path d="M22 29c1-4 9-4 10 0m4-10h6m-6 5h6M19 39h26M19 46h13m5 0h8M19 52h26" />
  </ItemPicture>;
}

function StaplerIcon({ className }: PictureProps) {
  return <ItemPicture className={className}>
    <path d="M10 36 40 15c6-4 11-3 13 2l-30 23z" />
    <path d="M12 41h43v8H12zM14 49v7h40v-7M20 40l-5-7" />
    <path d="M47 22l4 5" />
  </ItemPicture>;
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
  { name: "Gym tissues", icon: TissueBoxIcon },
  { name: "Hand soap", icon: SoapDispenserIcon },
  { name: "Floor liquid", icon: FloorCleanerIcon },
  { name: "Membership forms", icon: MembershipFormsIcon },
  { name: "Bar sales", icon: BarSalesIcon },
  { name: "Membership sales sheet", icon: MembershipSalesSheetIcon },
  { name: "Pens", icon: PenLine },
  { name: "Pencils", icon: Pencil },
  { name: "Markers", icon: Highlighter },
  { name: "Membership cards", icon: CreditCard },
  { name: "Staples", icon: StaplerIcon },
  { name: "Sticky notes", icon: StickyNote },
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
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-[#d74b00] shadow-sm">
                <Icon className="h-12 w-12" aria-hidden="true" />
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
