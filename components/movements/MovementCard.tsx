"use client";

import Image from "next/image";
import { useState } from "react";

import type { MovementDefinition } from "@/lib/movements/types";
import MovementDetail from "./MovementDetail";

export type MovementProgramming = {
  sets?: string;
  reps?: string;
  duration?: string;
  rest?: string;
  notes?: string;
};

export type MovementCardProps = {
  name: string;
  movement: MovementDefinition | null;
  programming?: MovementProgramming;
  context?: "trainer" | "mobility";
};

export default function MovementCard({
  name,
  movement,
  programming = {},
  context = "trainer",
}: MovementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasProgramming = Boolean(
    programming.sets ||
      programming.reps ||
      programming.duration ||
      programming.rest ||
      programming.notes,
  );

  return (
    <article
      data-movement-context={context}
      className="overflow-hidden rounded-2xl border border-zinc-200 border-t-2 border-t-[#ff5a0a] bg-white text-zinc-950 shadow-sm"
    >
      {movement ? (
        <div className="border-b border-zinc-100 bg-zinc-50/70 p-3">
          {movement.diagramAsset ? (
            <Image
              src={movement.diagramAsset}
              alt={`${name} start and end movement guide`}
              width={960}
              height={540}
              sizes="(max-width: 640px) 100vw, 640px"
              className="h-auto w-full rounded-xl border border-zinc-200 bg-white object-cover"
            />
          ) : (
            <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-4 text-center text-sm font-medium text-zinc-500">
              Visual guide coming soon
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-4 p-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-zinc-950">{name}</h3>
          {movement ? (
            <p className="mt-1 text-sm leading-6 text-zinc-600">{movement.description}</p>
          ) : null}
        </div>

        {hasProgramming ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-700">
            {programming.sets ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">{programming.sets} sets</span>
            ) : null}
            {programming.reps ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">{programming.reps} reps</span>
            ) : null}
            {programming.duration ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">{programming.duration}</span>
            ) : null}
            {programming.rest ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">Rest {programming.rest}</span>
            ) : null}
          </div>
        ) : null}

        {programming.notes ? (
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">
            {programming.notes}
          </p>
        ) : null}

        {movement ? (
          <div className="space-y-4">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a0a] focus-visible:ring-offset-2"
            >
              {expanded ? "Hide technique" : "View technique"}
            </button>
            {expanded ? <MovementDetail movement={movement} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
