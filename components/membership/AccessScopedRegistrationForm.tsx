"use client";

import { useState } from "react";
import RegistrationForm, {
  type PublicEnrollmentConfig,
  type RegistrationDraft,
  type RegistrationFormProps,
} from "@/components/membership/RegistrationForm";
import type { MembershipAccessScope } from "@/lib/membershipRegistrationTypes";

type Props = Omit<RegistrationFormProps, "config" | "onSubmit"> & {
  config: PublicEnrollmentConfig;
  onSubmit: (draft: RegistrationDraft) => Promise<void>;
};

export default function AccessScopedRegistrationForm({ config, onSubmit, ...props }: Props) {
  const hasSingleGymPricing = Boolean(config.singleGymPricing);
  const [accessScope, setAccessScope] = useState<MembershipAccessScope | "">(
    hasSingleGymPricing ? "" : "network"
  );

  const selectedConfig = accessScope === "single_gym" && config.singleGymPricing
    ? { ...config, pricing: config.singleGymPricing }
    : config;

  if (hasSingleGymPricing && !accessScope) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Access</p>
        <h1 className="mt-1 text-2xl font-black text-zinc-950">Choose membership access</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Choose whether this membership works at all BestGymsMalta gyms or only at {props.gym.name}.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAccessScope("network")}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-5 text-left transition hover:border-zinc-950"
          >
            <span className="block text-lg font-black text-zinc-950">All Access</span>
            <span className="mt-1 block text-sm font-semibold text-zinc-600">Access all BestGymsMalta gyms.</span>
          </button>
          <button
            type="button"
            onClick={() => setAccessScope("single_gym")}
            className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-5 text-left transition hover:border-orange-600"
          >
            <span className="block text-lg font-black text-orange-950">Single Gym</span>
            <span className="mt-1 block text-sm font-semibold text-orange-800">Access {props.gym.name} only.</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {hasSingleGymPricing && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Access selected</p>
              <p className="mt-1 font-black text-zinc-950">
                {accessScope === "single_gym" ? `${props.gym.name} Only` : "All Access"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAccessScope("")}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-black text-zinc-700"
            >
              Change
            </button>
          </div>
        </section>
      )}
      <RegistrationForm
        key={accessScope || "network"}
        {...props}
        config={selectedConfig}
        onSubmit={(draft) => onSubmit({ ...draft, accessScope: accessScope || "network" })}
      />
    </div>
  );
}
