"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronRight } from "lucide-react";
import { getSavedMember } from "@/lib/memberSession";

type SavedPlan = {
  goal: string;
  level: string;
  daysPerWeek: number;
  minutes: number;
  style: string;
  savedAt?: string;
};

export default function MemberWorkoutPlanPreview() {
  const [plan, setPlan] = useState<SavedPlan | null>(null);

  useEffect(() => {
    async function loadPlan() {
      const member = getSavedMember();

      if (!member) {
        setPlan(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/member/workout-plan?memberId=${member.id}`,
          { cache: "no-store" }
        );

        const data = await response.json();
        setPlan(data.savedPlan || null);
      } catch {
        setPlan(null);
      }
    }

    loadPlan();

    window.addEventListener("bgmMemberChanged", loadPlan);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadPlan);
    };
  }, []);

  if (!plan) return null;

  return (
    <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Saved AI Plan
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            {plan.goal}
          </h2>

          <p className="mt-2 text-sm font-bold leading-6 text-white/55">
            {plan.level} · {plan.daysPerWeek} days/week · {plan.minutes} min ·{" "}
            {plan.style}
          </p>
        </div>

        <Bot className="shrink-0 text-[#fcb415]" size={30} strokeWidth={3} />
      </div>

      <a
        href="/trainer"
        className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
      >
        Open AI Trainer
        <ChevronRight size={17} strokeWidth={3} />
      </a>
    </section>
  );
}
