"use client";

import { useEffect, useState } from "react";
import { CreditCard, Dumbbell, Sparkles, Stamp, X } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

const slides = [
  {
    title: "Your BGM member app",
    text: "Keep your membership, passport, trainer, progress and story tools in one place.",
    icon: Sparkles,
  },
  {
    title: "Digital membership card",
    text: "Use your account as your mobile member hub and keep your details close.",
    icon: CreditCard,
  },
  {
    title: "Collect passport stamps",
    text: "Scan gym QR codes when you visit and build your BestGymsMalta passport.",
    icon: Stamp,
  },
  {
    title: "Train, track and share",
    text: "Use the trainer, progress vault and story creator to keep moving forward.",
    icon: Dumbbell,
  },
];

export default function FirstTimeOnboarding() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    function checkMember() {
      const savedMember = getSavedMember();
      setMember(savedMember);

      if (!savedMember?.id) {
        setVisible(false);
        return;
      }

      const key = `bgmOnboardingComplete:${savedMember.id}`;
      const completed = window.localStorage.getItem(key);

      setVisible(!completed);
    }

    checkMember();
    window.addEventListener("bgmMemberChanged", checkMember);
    return () => {
      window.removeEventListener("bgmMemberChanged", checkMember);
    };
  }, []);

  function finish() {
    if (member?.id) {
      window.localStorage.setItem(`bgmOnboardingComplete:${member.id}`, "true");
    }
    setVisible(false);
  }

  if (!visible || !member) return null;

  const slide = slides[step];
  const Icon = slide.icon;
  const isLast = step === slides.length - 1;

  return (
    <div data-onboarding-surface="first-time-light" className="fixed inset-0 z-[80] flex items-end bg-black/55 p-4 backdrop-blur-sm sm:items-center">
      <section className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2.4rem] border border-zinc-200 bg-white p-6 text-zinc-950 shadow-2xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-100 blur-3xl" />
        <button type="button" onClick={finish} className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500" aria-label="Close onboarding">
          <X size={18} strokeWidth={3} />
        </button>

        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-950 p-2">
            <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-full w-full object-contain" />
          </div>

          <div className="mt-7 flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-[#ff5a0a] text-white shadow-lg shadow-orange-100">
            <Icon size={38} strokeWidth={3} />
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">Step {step + 1} of {slides.length}</p>
          <h2 className="mt-3 text-4xl font-black leading-tight">{slide.title}</h2>
          <p className="mt-4 text-sm font-bold leading-6 text-zinc-600">{slide.text}</p>

          <div className="mt-6 flex gap-2">
            {slides.map((item, index) => (
              <span key={item.title} className={index === step ? "h-2 flex-1 rounded-full bg-[#ff5a0a]" : "h-2 flex-1 rounded-full bg-zinc-100"} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={finish} className="rounded-full border border-zinc-200 bg-white px-5 py-4 text-sm font-black text-zinc-700">Skip</button>
            <button
              type="button"
              onClick={() => {
                if (isLast) finish();
                else setStep((current) => current + 1);
              }}
              className="rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100"
            >
              {isLast ? "Start" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
