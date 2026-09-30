"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { europeanDateFromIso, parseEuropeanDate } from "@/lib/europeanDate";

type Props = {
  value: string;
  onValueChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  placeholder?: string;
};

export default function EuropeanDateInput({
  value,
  onValueChange,
  min,
  max,
  required = false,
  disabled = false,
  readOnly = false,
  className = "",
  id,
  name,
  ariaLabel,
  placeholder = "DD/MM/YYYY",
}: Props) {
  const [text, setText] = useState(() => europeanDateFromIso(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(europeanDateFromIso(value));
    setInvalid(false);
  }, [value]);

  function inRange(iso: string) {
    if (min && iso < min) return false;
    if (max && iso > max) return false;
    return true;
  }

  function applyText(next: string) {
    setText(next);
    const parsed = parseEuropeanDate(next);
    if (parsed && inRange(parsed)) {
      setInvalid(false);
      onValueChange(parsed);
      return;
    }
    if (!next.trim()) {
      setInvalid(false);
      onValueChange("");
      return;
    }
    setInvalid(false);
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker || disabled || readOnly) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  }

  return (
    <div className="relative w-full">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        value={text}
        placeholder={placeholder}
        onChange={(event) => { if (!readOnly) applyText(event.target.value); }}
        onBlur={() => {
          if (!text.trim() && !required) return;
          const parsed = parseEuropeanDate(text);
          const invalidDate = !parsed || !inRange(parsed);
          setInvalid(invalidDate);
          if (invalidDate) onValueChange("");
        }}
        className={`${className} pr-11 ${invalid ? "border-red-400 ring-1 ring-red-300" : ""}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Choose date"
        disabled={disabled || readOnly}
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled || readOnly}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const next = event.target.value;
          onValueChange(next);
          setText(europeanDateFromIso(next));
          setInvalid(false);
        }}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
    </div>
  );
}
