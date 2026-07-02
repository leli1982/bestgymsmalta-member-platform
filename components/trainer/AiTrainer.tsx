"use client";

import { useMemo, useState } from "react";
import {
  Brain,
  CalendarDays,
  Dumbbell,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";

type Goal = "fat_loss" | "muscle" | "strength" | "fitness";
type Level = "beginner" | "intermediate" | "advanced";
type Style = "gym" | "functional" | "balanced";

type PlanDay = {
  title: string;
  focus: string;
  exercises: string[];
};

function goalLabel(goal: Goal) {
  if (goal === "fat_loss") return "Fat Loss";
  if (goal === "muscle") return "Build Muscle";
  if (goal === "strength") return "Strength";
  return "General Fitness";
}

function levelLabel(level: Level) {
  if (level === "beginner") return "Beginner";
  if (level === "intermediate") return "Intermediate";
  return "Advanced";
}

function styleLabel(style: Style) {
  if (style === "gym") return "Gym Machines & Weights";
  if (style === "functional") return "Functional Training";
  return "Balanced Training";
}

function getExercisePool(goal: Goal, style: Style) {
  const base = {
    warmup: [
      "5–8 min treadmill or bike warm-up",
      "Dynamic mobility: hips, shoulders and ankles",
      "Light activation set before first main exercise",
    ],
    coolDown: [
      "5 min easy cardio cooldown",
      "Stretch chest, hips, hamstrings and back",
      "Log how the session felt",
    ],
  };

  if (style === "functional") {
    return {
      ...base,
      main: [
        "Kettlebell deadlift",
        "TRX row",
        "Walking lunges",
        "Medicine ball slams",
        "Battle ropes intervals",
        "Box step-ups",
        "Farmer carries",
        "Plank shoulder taps",
      ],
    };
  }

  if (goal === "strength") {
    return {
      ...base,
      main: [
        "Squat or leg press",
        "Bench press or chest press",
        "Deadlift variation",
        "Lat pulldown",
        "Shoulder press",
        "Seated row",
        "Romanian deadlift",
        "Core plank hold",
      ],
    };
  }

  if (goal === "muscle") {
    return {
      ...base,
      main: [
        "Chest press",
        "Lat pulldown",
        "Leg press",
        "Shoulder press",
        "Seated row",
        "Leg curl",
        "Bicep curls",
        "Tricep pushdown",
      ],
    };
  }

  if (goal === "fat_loss") {
    return {
      ...base,
      main: [
        "Incline treadmill intervals",
        "Leg press",
        "Chest press",
        "Seated row",
        "Walking lunges",
        "Cable rotations",
        "Bike intervals",
        "Core finisher",
      ],
    };
  }

  return {
    ...base,
    main: [
      "Treadmill warm-up",
      "Leg press",
      "Chest press",
      "Lat pulldown",
      "Dumbbell shoulder press",
      "Cable row",
      "Bodyweight squats",
      "Core circuit",
    ],
  };
}

function buildPlan(
  goal: Goal,
  level: Level,
  daysPerWeek: number,
  minutes: number,
  style: Style,
  limitations: string
): PlanDay[] {
  const pool = getExercisePool(goal, style);

  const sets =
    level === "beginner" ? "2–3 sets" : level === "intermediate" ? "3–4 sets" : "4–5 sets";

  const reps =
    goal === "strength"
      ? "4–8 reps"
      : goal === "fat_loss"
      ? "10–15 reps or timed intervals"
      : "8–12 reps";

  const days: PlanDay[] = [];

  const focusList =
    daysPerWeek <= 2
      ? ["Full Body", "Full Body + Conditioning"]
      : daysPerWeek === 3
      ? ["Push", "Pull", "Legs + Core"]
      : daysPerWeek === 4
      ? ["Upper Body", "Lower Body", "Push + Core", "Pull + Conditioning"]
      : ["Push", "Pull", "Legs", "Upper Body", "Conditioning + Core"];

  for (let i = 0; i < daysPerWeek; i++) {
    const focus = focusList[i] || `Training Day ${i + 1}`;

    const selected = pool.main
      .slice(i, i + 5)
      .concat(pool.main.slice(0, Math.max(0, 5 - pool.main.slice(i, i + 5).length)));

    const exercises = [
      `${pool.warmup[i % pool.warmup.length]}`,
      ...selected.map((exercise) => `${exercise} — ${sets} x ${reps}`),
      `${pool.coolDown[i % pool.coolDown.length]}`,
    ];

    if (limitations.trim()) {
      exercises.push(`Trainer note: adjust movements around "${limitations.trim()}".`);
    }

    if (minutes <= 35) {
      exercises.push("Keep rest short: 45–60 seconds between sets.");
    } else if (minutes >= 60) {
      exercises.push("Add 1–2 extra accessory exercises if energy is good.");
    }

    days.push({
      title: `Day ${i + 1}`,
      focus,
      exercises,
    });
  }

  return days;
}

export default function AiTrainer() {
  const [goal, setGoal] = useState<Goal>("fitness");
  const [level, setLevel] = useState<Level>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [style, setStyle] = useState<Style>("balanced");
  const [limitations, setLimitations] = useState("");
  const [generated, setGenerated] = useState(false);

  const plan = useMemo(
    () => buildPlan(goal, level, daysPerWeek, minutes, style, limitations),
    [goal, level, daysPerWeek, minutes, style, limitations]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
        <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
            AI Trainer
          </p>
        </div>

        <h1 className="mt-5 text-4xl font-black leading-tight text-white">
          Build your next workout
        </h1>

        <p className="mt-4 text-sm leading-6 text-white/55">
          Choose your goal, level and training style. Your BGM trainer will
          generate a simple plan you can follow inside any BestGymsMalta gym.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
          <ShieldAlert className="mt-0.5 shrink-0 text-orange-500" size={20} strokeWidth={3} />
          <p className="text-xs font-bold leading-5 text-white/55">
            This is a prototype training guide, not medical advice. Members
            should train within their ability and ask gym staff for help when
            unsure.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-orange-500 p-3 text-black">
            <Brain size={24} strokeWidth={3} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Trainer Setup
            </p>
            <h2 className="text-2xl font-black text-white">Your plan</h2>
          </div>
        </div>

        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/40">
              <Target size={15} strokeWidth={3} />
              Goal
            </span>
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value as Goal)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
            >
              <option value="fitness">General Fitness</option>
              <option value="fat_loss">Fat Loss</option>
              <option value="muscle">Build Muscle</option>
              <option value="strength">Strength</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/40">
              <Zap size={15} strokeWidth={3} />
              Level
            </span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as Level)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/40">
              <CalendarDays size={15} strokeWidth={3} />
              Days per week: {daysPerWeek}
            </span>
            <input
              type="range"
              min="2"
              max="5"
              value={daysPerWeek}
              onChange={(event) => setDaysPerWeek(Number(event.target.value))}
              className="w-full accent-orange-500"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/40">
              <Timer size={15} strokeWidth={3} />
              Workout length: {minutes} minutes
            </span>
            <input
              type="range"
              min="30"
              max="75"
              step="15"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="w-full accent-orange-500"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/40">
              <Dumbbell size={15} strokeWidth={3} />
              Training Style
            </span>
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value as Style)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
            >
              <option value="balanced">Balanced Training</option>
              <option value="gym">Gym Machines & Weights</option>
              <option value="functional">Functional Training</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/40">
              Limitations or notes
            </span>
            <textarea
              value={limitations}
              onChange={(event) => setLimitations(event.target.value)}
              placeholder="Example: knee pain, lower back, shoulder, beginner, short on time..."
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
            />
          </label>

          <button
            type="button"
            onClick={() => setGenerated(true)}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black transition active:scale-95"
          >
            {generated ? (
              <RefreshCw size={18} strokeWidth={3} />
            ) : (
              <Sparkles size={18} strokeWidth={3} />
            )}
            {generated ? "Update Plan" : "Generate Plan"}
          </button>
        </div>
      </section>

      {generated ? (
        <section className="space-y-4">
          <div className="rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Generated Plan
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">
              {goalLabel(goal)} · {levelLabel(level)}
            </h2>
            <p className="mt-2 text-sm font-bold text-white/50">
              {daysPerWeek} days per week · {minutes} minutes · {styleLabel(style)}
            </p>
          </div>

          {plan.map((day) => (
            <div
              key={day.title}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                    {day.title}
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {day.focus}
                  </h3>
                </div>

                <div className="rounded-2xl bg-white/10 p-3 text-orange-500">
                  <Dumbbell size={22} strokeWidth={3} />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {day.exercises.map((exercise) => (
                  <div
                    key={exercise}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <p className="text-sm font-bold leading-5 text-white/65">
                      {exercise}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
