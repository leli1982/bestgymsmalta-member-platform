"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, HeartPulse } from "lucide-react";
import MovementCard from "@/components/movements/MovementCard";
import AppShell from "@/components/ui/AppShell";
import { mobilityGroups } from "@/lib/movements/mobilityGroups";
import { resolveMovement } from "@/lib/movements/resolveMovement";

export default function MobilityStretchPage() {
  const [selectedCategory, setSelectedCategory] = useState("fullBody");

  const category = useMemo(
    () =>
      mobilityGroups.find((group) => group.id === selectedCategory) ??
      mobilityGroups[0],
    [selectedCategory],
  );

  return (
    <AppShell theme="light">
      <div
        data-member-surface="mobility-light"
        className="min-h-screen bg-[#f6f6f6] px-4 pb-28 pt-5 text-zinc-950"
      >
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-zinc-900 shadow-lg">
            <img
              src="/images/mobility-stretch-card.png"
              alt="Mobility and Stretch"
              className="h-64 w-full object-cover opacity-85"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                <HeartPulse className="h-4 w-4" />
                Recovery guide
              </div>

              <h1 className="text-3xl font-black tracking-tight text-white">
                Mobility & Stretch
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-neutral-200">
                Stretch smarter, move better and recover faster with simple
                routines by body area.
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Important
            </div>
            These are general stretching suggestions. Stop if you feel pain,
            numbness, dizziness or sharp discomfort. Always consult with a
            medical professional before starting any stretching or exercise
            routine, especially if you have an injury, medical condition or
            ongoing pain.
          </section>

          <section className="mt-5 rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-sm font-bold text-zinc-700">
              Choose stretch area
            </label>

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-semibold text-zinc-950 outline-none focus:border-[#ff5a0a] focus:ring-2 focus:ring-[#ff5a0a]/10"
            >
              {mobilityGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </section>

          <section className="mt-5">
            <div className="mb-4">
              <h2 className="text-2xl font-black">{category.label}</h2>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                {category.intro}
              </p>
            </div>

            <div className="grid gap-4">
              {category.entries.map((entry) => {
                const movement = resolveMovement({
                  movementId: entry.movementId,
                  name: null,
                });
                const name = movement?.name ?? entry.movementId;

                return (
                  <MovementCard
                    key={entry.movementId}
                    name={name}
                    movement={movement}
                    programming={{ duration: entry.programming }}
                    context="mobility"
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
