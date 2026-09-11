"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

export default function MemberBarcode({
  memberNumber,
}: {
  memberNumber: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !memberNumber) return;

    JsBarcode(ref.current, memberNumber, {
      format: "CODE128",
      displayValue: false,
      background: "#ffffff",
      lineColor: "#000000",
      height: 54,
      margin: 8,
      width: 1.7,
    });
  }, [memberNumber]);

  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <svg
        ref={ref}
        className="h-auto w-full"
        aria-label={`Member barcode ${memberNumber}`}
      />
      <p className="mt-1 text-center font-mono text-xs font-bold tracking-[0.16em] text-black">
        {memberNumber}
      </p>
    </div>
  );
}
