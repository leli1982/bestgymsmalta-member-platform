"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  Zap,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type Exercise =
  | string
  | {
      name?: string;
      sets?: string;
      reps?: string;
      notes?: string;
    };

type TrainingDay = {
  title?: string;
  day?: string;
  focus?: string;
  exercises?: Exercise[];
  notes?: string;
};

type WorkoutPlan = {
  id?: string;
  title?: string;
  summary?: string;
  overview?: string;
  createdAt?: string;
  created_at?: string;
  days?: TrainingDay[];
  raw?: string;
};

const goals = [
  "Build muscle",
  "Lose fat",
  "Get stronger",
  "Improve fitness",
  "Tone up",
  "General health",
];

const levels = ["Beginner", "Intermediate", "Advanced"];

const focusAreas = [
  "Full body",
  "Upper body",
  "Lower body",
  "Push / Pull / Legs",
  "Strength",
  "Conditioning",
];

const fieldClass =
  "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-950 outline-none transition focus:border-[#ff5a0a] focus:ring-2 focus:ring-[#ff5a0a]/10";
const fieldLabelClass =
  "text-xs font-black uppercase tracking-[.18em] text-zinc-500";

function formatDate(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizePlanPayload(data: any): WorkoutPlan | null {
  const savedPlan = data?.savedPlan || data?.saved_plan || null;

  const payload =
    data?.plan ||
    savedPlan?.plan ||
    savedPlan?.plan_json ||
    savedPlan?.planJson ||
    data?.workoutPlan ||
    data?.workout_plan ||
    data?.data ||
    null;

  if (!payload) return null;

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return normalizePlanPayload({ plan: parsed });
    } catch {
      return {
        title: "Your AI Training Plan",
        raw: payload,
      };
    }
  }

  if (typeof payload !== "object") return null;

  return {
    id: payload.id,
    title:
      payload.title ||
      payload.name ||
      payload.planTitle ||
      "Your AI Training Plan",
    summary:
      payload.summary ||
      payload.overview ||
      payload.description ||
      payload.notes ||
      "",
    overview: payload.overview || "",
    createdAt:
      payload.createdAt ||
      payload.created_at ||
      savedPlan?.savedAt ||
      savedPlan?.saved_at,
    created_at: payload.created_at,
    days:
      payload.days ||
      payload.trainingDays ||
      payload.training_days ||
      payload.workouts ||
      [],
    raw: payload.raw,
  };
}

function renderExercise(exercise: Exercise, index: number) {
  if (typeof exercise === "string") {
    return (
      <li
        key={index}
        className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold leading-6 text-zinc-700"
      >
        {exercise}
      </li>
    );
  }

  return (
    <li key={index} className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-sm font-black text-zinc-950">
        {exercise.name || `Exercise ${index + 1}`}
      </p>

      {exercise.sets || exercise.reps ? (
        <p className="mt-1 text-xs font-black text-[#ff5a0a]">
          {[exercise.sets, exercise.reps].filter(Boolean).join(" × ")}
        </p>
      ) : null}

      {exercise.notes ? (
        <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
          {exercise.notes}
        </p>
      ) : null}
    </li>
  );
}

export default function AiTrainer() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [goal, setGoal] = useState("Build muscle");
  const [level, setLevel] = useState("Beginner");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [sessionTime, setSessionTime] = useState("45");
  const [focus, setFocus] = useState("Full body");
  const [limitations, setLimitations] = useState("");

  useEffect(() => {
    setMember(getSavedMember());
  }, []);

  useEffect(() => {
    if (!member?.id) {
      setLoadingPlan(false);
      return;
    }

    loadSavedPlan(member.id);
  }, [member?.id]);

  const planDate = useMemo(() => {
    return formatDate(plan?.createdAt || plan?.created_at);
  }, [plan]);

  async function parseResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    return {
      plan: await response.text(),
    };
  }

  async function loadSavedPlan(memberId: string) {
    try {
      setLoadingPlan(true);

      const response = await fetch(
        `/api/member/workout-plan?memberId=${encodeURIComponent(memberId)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) return;

      const data = await parseResponse(response);
      const normalised = normalizePlanPayload(data);

      if (normalised) {
        setPlan(normalised);
      }
    } catch {
      // Some older API versions may only support POST. Ignore silently.
    } finally {
      setLoadingPlan(false);
    }
  }

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!member?.id) return;

    try {
      setGenerating(true);
      setError("");

      const response = await fetch("/api/member/workout-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member.id,
          goal,
          experience: level,
          level,
          daysPerWeek: Number(daysPerWeek),
          sessionTime: Number(sessionTime),
          minutes: Number(sessionTime),
          focus,
          style: focus,
          limitations,
          notes: limitations,
        }),
      });

      const data = await parseResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not generate workout plan.");
      }

      const normalised = normalizePlanPayload(data);

      setPlan(
        normalised || {
          title: "Your AI Training Plan",
          raw: JSON.stringify(data, null, 2),
        }
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not generate workout plan."
      );
    } finally {
      setGenerating(false);
    }
  }

  if (!member) {
    return (
      <div data-member-surface="trainer-light" className="space-y-6 text-zinc-950">
        <section
          className="relative min-h-[330px] overflow-hidden rounded-[2rem] border border-zinc-200 bg-cover bg-center p-6 shadow-lg"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.86)), linear-gradient(135deg, rgba(255,90,10,.26), rgba(0,0,0,.82)), url('/visuals/trainer.jpg')",
          }}
        >
          <div className="relative flex min-h-[282px] flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff9b60]">
                  AI Trainer
                </p>
              </div>
              <img
                src="/bgm-trainer-icon.png"
                alt=""
                className="h-14 w-14 object-contain drop-shadow-2xl mix-blend-screen"
              />
            </div>

            <div>
              <Lock className="text-[#ff7a2f]" size={30} strokeWidth={3} />
              <h1 className="mt-3 max-w-sm text-4xl font-black leading-[0.95] text-white drop-shadow-2xl">
                Your virtual trainer
              </h1>
              <p className="mt-4 max-w-xs text-sm font-bold leading-6 text-white/75">
                Log in to generate and save a training plan against your BGM
                member profile.
              </p>
              <a
                href="/member-login"
                className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-950/20"
              >
                Login / Activate
                <ChevronRight size={17} strokeWidth={3} />
              </a>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div data-member-surface="trainer-light" className="space-y-5 text-zinc-950">
      <section
        className="relative min-h-[340px] overflow-hidden rounded-[2rem] border border-zinc-200 bg-cover bg-center p-5 shadow-lg"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.84)), linear-gradient(135deg, rgba(255,90,10,.26), rgba(0,0,0,.82)), url('/visuals/trainer.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/90" />
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#ff5a0a]/25 blur-3xl" />

        <div className="relative flex min-h-[298px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff9b60]">
                AI Trainer
              </p>
            </div>
            <img
              src="/bgm-trainer-icon.png"
              alt=""
              className="h-14 w-14 object-contain drop-shadow-2xl mix-blend-screen"
            />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#ff9b60]">
              Built around your goal
            </p>
            <h1 className="mt-3 text-4xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Your virtual trainer
            </h1>
            <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/75">
              Generate a simple gym plan based on your level, goal and weekly
              routine.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md">
                <Target className="text-[#ff7a2f]" size={20} strokeWidth={3} />
                <p className="mt-2 truncate text-sm font-black text-white">{goal}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md">
                <CalendarDays className="text-[#ff7a2f]" size={20} strokeWidth={3} />
                <p className="mt-2 text-sm font-black text-white">{daysPerWeek}x</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md">
                <Clock3 className="text-[#ff7a2f]" size={20} strokeWidth={3} />
                <p className="mt-2 text-sm font-black text-white">{sessionTime}m</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-orange-200 bg-orange-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#ff5a0a] shadow-sm">
            <ShieldCheck size={24} strokeWidth={3} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#ff5a0a]">
              Smart Guidance
            </p>
            <h2 className="mt-1 text-2xl font-black text-zinc-950">Train with structure</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              Your plan is guidance only. Train safely, use good form and ask a
              coach if you are unsure about an exercise.
            </p>
          </div>
        </div>
      </section>

      <form
        onSubmit={generatePlan}
        className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff5a0a]/10 text-[#ff5a0a]">
            <Bot size={24} strokeWidth={3} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#ff5a0a]">Plan Builder</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-950">Create your plan</h2>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className={fieldLabelClass}>Main goal</span>
            <select value={goal} onChange={(event) => setGoal(event.target.value)} className={fieldClass}>
              {goals.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className={fieldLabelClass}>Level</span>
              <select value={level} onChange={(event) => setLevel(event.target.value)} className={fieldClass}>
                {levels.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className={fieldLabelClass}>Focus</span>
              <select value={focus} onChange={(event) => setFocus(event.target.value)} className={fieldClass}>
                {focusAreas.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className={fieldLabelClass}>Days per week</span>
              <select value={daysPerWeek} onChange={(event) => setDaysPerWeek(event.target.value)} className={fieldClass}>
                {["1", "2", "3", "4", "5", "6", "7"].map((item) => (
                  <option key={item} value={item}>{item} days</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className={fieldLabelClass}>Session time</span>
              <select value={sessionTime} onChange={(event) => setSessionTime(event.target.value)} className={fieldClass}>
                {["30", "45", "60", "75", "90"].map((item) => (
                  <option key={item} value={item}>{item} minutes</option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className={fieldLabelClass}>Injuries, limitations or notes</span>
            <textarea
              value={limitations}
              onChange={(event) => setLimitations(event.target.value)}
              rows={3}
              placeholder="Example: knee pain, avoid deadlifts, prefer machines..."
              className={`${fieldClass} leading-6 placeholder:text-zinc-400`}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={generating}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-200 disabled:opacity-60"
        >
          {generating ? (
            <>
              <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
              Building plan…
            </>
          ) : (
            <>
              Generate Plan
              <Zap size={17} strokeWidth={3} />
            </>
          )}
        </button>
      </form>

      <section className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff5a0a]/10 text-[#ff5a0a]">
              <Dumbbell size={24} strokeWidth={3} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#ff5a0a]">Current Plan</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">Your training week</h2>
            </div>
          </div>
          {loadingPlan ? <RefreshCw className="animate-spin text-[#ff5a0a]" size={22} /> : null}
        </div>

        {!plan && !loadingPlan ? (
          <div className="mt-5 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6 text-center">
            <Sparkles className="mx-auto text-[#ff5a0a]" size={38} strokeWidth={3} />
            <h3 className="mt-4 text-2xl font-black text-zinc-950">No plan yet</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
              Build your first AI training plan and save it to your member profile.
            </p>
          </div>
        ) : null}

        {plan ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5">
              <div className="flex items-start gap-3">
                <Trophy className="mt-0.5 shrink-0 text-[#ff5a0a]" size={25} strokeWidth={3} />
                <div>
                  <h3 className="text-xl font-black text-zinc-950">{plan.title || "Your AI Training Plan"}</h3>
                  {planDate ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-[.16em] text-[#ff5a0a]">Created {planDate}</p>
                  ) : null}
                  {plan.summary || plan.overview ? (
                    <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{plan.summary || plan.overview}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {plan.days && plan.days.length > 0 ? (
              <div className="space-y-3">
                {plan.days.map((day, index) => (
                  <article key={`${day.title || day.day || "day"}-${index}`} className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white">
                        <Flame size={22} strokeWidth={3} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-400">Day {index + 1}</p>
                        <h3 className="mt-1 text-xl font-black text-zinc-950">{day.title || day.day || `Training Day ${index + 1}`}</h3>
                        {day.focus ? <p className="mt-1 text-sm font-black text-[#ff5a0a]">{day.focus}</p> : null}
                      </div>
                    </div>

                    {day.exercises && day.exercises.length > 0 ? (
                      <ul className="mt-4 grid gap-2">{day.exercises.map(renderExercise)}</ul>
                    ) : null}

                    {day.notes ? <p className="mt-4 text-sm font-semibold leading-6 text-zinc-500">{day.notes}</p> : null}
                  </article>
                ))}
              </div>
            ) : plan.raw ? (
              <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
                <pre className="whitespace-pre-wrap text-sm font-semibold leading-6 text-zinc-600">{plan.raw}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <Activity className="text-[#ff5a0a]" size={23} strokeWidth={3} />
          <h3 className="mt-3 text-lg font-black text-zinc-950">Track progress</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">Use your Progress Vault to keep visual updates alongside your plan.</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <UserCheck className="text-[#ff5a0a]" size={23} strokeWidth={3} />
          <h3 className="mt-3 text-lg font-black text-zinc-950">Ask a coach</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">Need help with form? Ask a BGM team member in the gym.</p>
        </div>

        <a href="/progress" className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Progress Vault</h3>
            <p className="mt-1 text-xs font-semibold text-zinc-500">Save photos</p>
          </div>
          <ChevronRight className="text-[#ff5a0a]" size={22} strokeWidth={3} />
        </a>

        <a href="/story" className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Share Story</h3>
            <p className="mt-1 text-xs font-semibold text-zinc-500">Create post</p>
          </div>
          <ChevronRight className="text-[#ff5a0a]" size={22} strokeWidth={3} />
        </a>
      </section>

      <section className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-[#ff5a0a]" size={25} strokeWidth={3} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#ff5a0a]">Trainer Tip</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-950">Consistency beats perfection</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              A realistic plan that you follow is better than a perfect plan you quit after one week. Start simple and build momentum.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
