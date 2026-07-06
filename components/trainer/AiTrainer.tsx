"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Dumbbell,
  LogIn,
  MessageCircle,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type WorkoutDay = {
  title: string;
  focus: string;
  exercises: string[];
};

type GeneratedPlan = {
  title: string;
  summary: string;
  days: WorkoutDay[];
  tips: string[];
  generatedAt: string;
  version: number;
};

const goals = [
  "Build muscle",
  "Lose fat",
  "Improve fitness",
  "Strength",
  "Tone up",
  "General health",
];

const levels = ["Beginner", "Intermediate", "Advanced"];

const styles = [
  "Gym machines",
  "Free weights",
  "Bodyweight",
  "Mixed gym workout",
  "Strength and conditioning",
];

function makeWorkoutPlan(
  goal: string,
  level: string,
  daysPerWeek: number,
  minutes: number,
  style: string,
  limitations: string,
  version: number
): GeneratedPlan {
  const focusPool = [
    "Full Body",
    "Upper Body",
    "Lower Body",
    "Push",
    "Pull",
    "Legs",
    "Core & Conditioning",
  ];

  const exercisePool: Record<string, string[]> = {
    "Full Body": [
      "Leg press or goblet squat",
      "Chest press or push-ups",
      "Lat pulldown",
      "Romanian deadlift",
      "Plank hold",
    ],
    "Upper Body": [
      "Chest press",
      "Seated row",
      "Shoulder press",
      "Lat pulldown",
      "Cable curls and triceps pressdown",
    ],
    "Lower Body": [
      "Leg press",
      "Hamstring curl",
      "Walking lunges",
      "Glute bridge",
      "Standing calf raises",
    ],
    Push: [
      "Incline chest press",
      "Shoulder press",
      "Cable fly",
      "Lateral raises",
      "Triceps rope pressdown",
    ],
    Pull: [
      "Lat pulldown",
      "Seated row",
      "Face pulls",
      "Dumbbell curls",
      "Back extension",
    ],
    Legs: [
      "Squat or leg press",
      "Romanian deadlift",
      "Leg extension",
      "Hamstring curl",
      "Core finisher",
    ],
    "Core & Conditioning": [
      "Bike or treadmill intervals",
      "Cable woodchops",
      "Plank",
      "Farmer carries",
      "Stretching cooldown",
    ],
  };

  const days: WorkoutDay[] = Array.from({ length: daysPerWeek }).map((_, index) => {
    const focus = focusPool[(index + version) % focusPool.length];

    return {
      title: `Day ${index + 1}`,
      focus,
      exercises: exercisePool[focus].map((exercise) => {
        if (level === "Beginner") return `${exercise} · 2-3 sets`;
        if (level === "Advanced") return `${exercise} · 4-5 sets`;
        return `${exercise} · 3-4 sets`;
      }),
    };
  });

  return {
    title: `${goal} · ${daysPerWeek} day plan`,
    summary: `${level} ${style.toLowerCase()} plan built for around ${minutes} minutes per session.${
      limitations ? ` Notes: ${limitations}` : ""
    }`,
    days,
    tips: [
      "Warm up for 5-10 minutes before each session.",
      "Keep 1-2 reps in reserve on most working sets.",
      "Progress slowly by adding reps or weight when form feels solid.",
      "If pain feels sharp or unusual, stop and ask a coach for guidance.",
    ],
    generatedAt: new Date().toISOString(),
    version,
  };
}

export default function AiTrainer() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [goal, setGoal] = useState("Build muscle");
  const [level, setLevel] = useState("Beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [style, setStyle] = useState("Mixed gym workout");
  const [limitations, setLimitations] = useState("");
  const [planVersion, setPlanVersion] = useState(1);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [status, setStatus] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState("");

  useEffect(() => {
    async function loadMemberAndPlan() {
      const savedMember = getSavedMember();
      setMember(savedMember);

      if (!savedMember) {
        setLoadingSaved(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/member/workout-plan?memberId=${savedMember.id}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (data.savedPlan) {
          setGoal(data.savedPlan.goal || "Build muscle");
          setLevel(data.savedPlan.level || "Beginner");
          setDaysPerWeek(data.savedPlan.daysPerWeek || 3);
          setMinutes(data.savedPlan.minutes || 45);
          setStyle(data.savedPlan.style || "Mixed gym workout");
          setLimitations(data.savedPlan.limitations || "");
          setPlan(data.savedPlan.plan || null);
          setStatus("Loaded your saved member plan.");
        }
      } catch {
        setStatus("Could not load saved plan.");
      } finally {
        setLoadingSaved(false);
      }
    }

    loadMemberAndPlan();
  }, []);

  const completionText = useMemo(() => {
    if (!plan) return "No plan generated yet.";

    return `${plan.days.length} workout days · ${minutes} minutes each`;
  }, [plan, minutes]);

  function generatePlan() {
    const generated = makeWorkoutPlan(
      goal,
      level,
      daysPerWeek,
      minutes,
      style,
      limitations,
      planVersion
    );

    setPlan(generated);
    setStatus("New plan generated. Tap Save My Plan to store it.");
  }

  function updatePlan() {
    const nextVersion = planVersion + 1;
    setPlanVersion(nextVersion);

    const generated = makeWorkoutPlan(
      goal,
      level,
      daysPerWeek,
      minutes,
      style,
      limitations,
      nextVersion
    );

    setPlan(generated);
    setStatus("Plan updated with a fresh variation.");
  }

  async function savePlan() {
    if (!member) {
      setStatus("Please log in before saving your plan.");
      return;
    }

    if (!plan) {
      setStatus("Generate a plan first.");
      return;
    }

    setStatus("Saving plan…");

    const response = await fetch("/api/member/workout-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        memberId: member.id,
        goal,
        level,
        daysPerWeek,
        minutes,
        style,
        limitations,
        plan,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save plan.");
      return;
    }

    setStatus(data.message || "Workout plan saved.");
  }

  async function clearSavedPlan() {
    if (!member) {
      setStatus("Please log in first.");
      return;
    }

    const confirmed = window.confirm("Clear your saved AI Trainer plan?");
    if (!confirmed) return;

    setStatus("Clearing saved plan…");

    const response = await fetch(
      `/api/member/workout-plan?memberId=${member.id}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not clear plan.");
      return;
    }

    setPlan(null);
    setStatus(data.message || "Saved plan cleared.");
  }

  function askTrainer() {
    const question = chatInput.trim();

    if (!question) return;

    const lower = question.toLowerCase();

    if (lower.includes("cardio")) {
      setChatReply(
        "Add 10-20 minutes of easy cardio after weights, or do 1-2 separate cardio days. Keep it light enough that it does not ruin your recovery."
      );
    } else if (lower.includes("protein") || lower.includes("food")) {
      setChatReply(
        "Aim for a protein source in each meal and keep your meals consistent. For specific nutrition advice, speak to a qualified professional."
      );
    } else if (lower.includes("pain") || lower.includes("injury")) {
      setChatReply(
        "Do not train through sharp pain. Stop that exercise and ask a coach or medical professional to check it."
      );
    } else if (lower.includes("progress")) {
      setChatReply(
        "Track weights, reps and consistency. When your form is clean and the set feels controlled, add a little weight or one extra rep."
      );
    } else {
      setChatReply(
        "Keep the plan simple, consistent and progressive. Train with good form, recover well, and ask a BGM coach if you want this adjusted in person."
      );
    }

    setChatInput("");
  }

  if (loadingSaved) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 text-white/45">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading AI Trainer…</p>
        </div>
      </section>
    );
  }

  if (!member) {
    return (
      <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-6 text-center">
        <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-2 border-[#fcb415]/40 bg-black/40 shadow-2xl">
          <img
            src="/bgm-trainer-icon.png"
            alt="BGM AI Trainer Login"
            className="h-full w-full object-cover"
          />
        </div>
        <h1 className="mt-5 text-4xl font-black text-white">AI Trainer</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-white/55">
          Log in to generate and save your training plan to your member account.
        </p>

        <a
          href="/member-login"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          <LogIn size={17} strokeWidth={3} />
          Login / Activate
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#fcb415]/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#fcb415]/20 blur-3xl" />

        <div className="absolute right-5 top-5 z-10 h-24 w-24 overflow-hidden rounded-full border-2 border-[#fcb415]/40 bg-black/40 shadow-2xl">
          <img
            src="/bgm-trainer-icon.png"
            alt="BGM AI Trainer"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="relative pr-24">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
            AI Trainer
          </p>

          <h1 className="mt-4 text-4xl font-black leading-tight text-white">
            Build your member plan
          </h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Saved to {member.username || member.fullName || "your member account"}.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Current Plan
            </p>
            <p className="mt-2 text-lg font-black text-white">
              {completionText}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Goal
            </span>
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
            >
              {goals.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Level
              </span>
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              >
                {levels.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Days / Week
              </span>
              <select
                value={daysPerWeek}
                onChange={(event) => setDaysPerWeek(Number(event.target.value))}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Minutes
              </span>
              <select
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              >
                {[30, 45, 60, 75, 90].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Style
              </span>
              <select
                value={style}
                onChange={(event) => setStyle(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              >
                {styles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <textarea
            value={limitations}
            onChange={(event) => setLimitations(event.target.value)}
            placeholder="Limitations, injuries or notes optional"
            className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={generatePlan}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              <Sparkles size={17} strokeWidth={3} />
              Generate
            </button>

            <button
              type="button"
              onClick={updatePlan}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
            >
              <RefreshCw size={17} strokeWidth={3} />
              Update
            </button>
          </div>
        </div>
      </section>

      {plan ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start gap-3">
            <Dumbbell className="mt-1 text-[#fcb415]" size={25} strokeWidth={3} />
            <div>
              <h2 className="text-2xl font-black text-white">{plan.title}</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-white/50">
                {plan.summary}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {plan.days.map((day) => (
              <div
                key={day.title}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
                  {day.title}
                </p>
                <h3 className="mt-2 text-lg font-black text-white">
                  {day.focus}
                </h3>

                <div className="mt-3 grid gap-2">
                  {day.exercises.map((exercise) => (
                    <p
                      key={exercise}
                      className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/60"
                    >
                      {exercise}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#fcb415]/30 bg-[#fcb415]/10 p-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
              Coach Notes
            </p>
            <div className="mt-3 grid gap-2">
              {plan.tips.map((tip) => (
                <p key={tip} className="text-sm font-bold leading-6 text-white/60">
                  {tip}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={savePlan}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              <Save size={17} strokeWidth={3} />
              Save My Plan
            </button>

            <button
              type="button"
              onClick={clearSavedPlan}
              className="flex items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-black text-red-300"
            >
              <Trash2 size={17} strokeWidth={3} />
              Clear
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <MessageCircle className="text-[#fcb415]" size={24} strokeWidth={3} />
          <h2 className="text-2xl font-black text-white">Ask the Trainer</h2>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask about cardio, progress, protein, injuries..."
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <button
            type="button"
            onClick={askTrainer}
            className="rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            Ask
          </button>
        </div>

        {chatReply ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-bold leading-6 text-white/60">
              {chatReply}
            </p>
          </div>
        ) : null}
      </section>

      {status ? (
        <p className="text-center text-sm font-bold text-white/50">{status}</p>
      ) : null}
    </div>
  );
}
