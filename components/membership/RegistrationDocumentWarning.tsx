"use client";

import type { MembershipType } from "@/lib/membershipSettingsCore";
import { requiredDocumentMessage } from "@/lib/membershipRegistrationCore";

type Props = {
  membershipType: MembershipType;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
};

export default function RegistrationDocumentWarning({
  membershipType,
  acknowledged,
  onAcknowledge,
}: Props) {
  const messages = requiredDocumentMessage(membershipType);

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
        Before you continue
      </p>
      <h2 className="mt-1 text-xl font-black text-zinc-950">You will need at reception</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Please make sure you have these documents with you before completing the application.
      </p>

      <ul className="mt-4 space-y-2 text-sm font-semibold text-zinc-900">
        {messages.map((message) => (
          <li key={message} className="flex gap-2">
            <span aria-hidden="true" className="mt-0.5 text-amber-700">✓</span>
            <span>{message}</span>
          </li>
        ))}
      </ul>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4 text-sm font-semibold text-zinc-800">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledge(event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-zinc-950"
        />
        <span>I understand these requirements and I am ready to continue.</span>
      </label>
    </section>
  );
}
