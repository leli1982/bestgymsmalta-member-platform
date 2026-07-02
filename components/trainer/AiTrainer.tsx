"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CalendarDays,
  Dumbbell,
  FileText,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Trash2,
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

type SavedWorkoutPlan = {
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  minutes: number;
  style: Style;
  limitations: string;
  planVersion: number;
  savedAt: string;
  plan: PlanDay[];
};

type ChatMessage = {
  id: string;
  role: "user" | "trainer";
  text: string;
};

const STORAGE_KEY = "bgmSavedWorkoutPlan";

const quickPrompts = [
  "Give me a 30 minute workout",
  "Make this plan harder",
  "I have knee pain",
  "Give me a leg workout",
];

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

function rotateList(list: string[], amount: number) {
  const offset = amount % list.length;
  return [...list.slice(offset), ...list.slice(0, offset)];
}

function buildPlan(
  goal: Goal,
  level: Level,
  daysPerWeek: number,
  minutes: number,
  style: Style,
  limitations: string,
  planVersion: number
): PlanDay[] {
  const pool = getExercisePool(goal, style);

  const sets =
    level === "beginner"
      ? "2–3 sets"
      : level === "intermediate"
      ? "3–4 sets"
      : "4–5 sets";

  const reps =
    goal === "strength"
      ? "4–8 reps"
      : goal === "fat_loss"
      ? "10–15 reps or timed intervals"
      : "8–12 reps";

  const focusList =
    daysPerWeek <= 2
      ? ["Full Body", "Full Body + Conditioning"]
      : daysPerWeek === 3
      ? ["Push", "Pull", "Legs + Core"]
      : daysPerWeek === 4
      ? ["Upper Body", "Lower Body", "Push + Core", "Pull + Conditioning"]
      : daysPerWeek === 5
      ? ["Push", "Pull", "Legs", "Upper Body", "Conditioning + Core"]
      : daysPerWeek === 6
      ? ["Push", "Pull", "Legs", "Push", "Pull", "Legs + Core"]
      : [
          "Chest + Triceps",
          "Back + Biceps",
          "Legs",
          "Shoulders + Core",
          "Conditioning",
          "Full Body",
          "Mobility + Cardio",
        ];

  const days: PlanDay[] = [];

  for (let i = 0; i < daysPerWeek; i++) {
    const focus = focusList[i] || `Training Day ${i + 1}`;
    const rotatedMain = rotateList(pool.main, i + planVersion * 2);
    const selected = rotatedMain.slice(0, 5);

    const exercises = [
      `${pool.warmup[i % pool.warmup.length]}`,
      ...selected.map((exercise) => `${exercise} — ${sets} x ${reps}`),
      `${pool.coolDown[i % pool.coolDown.length]}`,
    ];

    if (limitations.trim()) {
      exercises.push(
        `Trainer note: adjust movements around "${limitations.trim()}".`
      );
    }

    if (daysPerWeek >= 6) {
      exercises.push(
        "Recovery note: because this is a high-frequency plan, keep at least 1–2 days lighter."
      );
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

function buildTrainerReply(
  message: string,
  goal: Goal,
  level: Level,
  minutes: number
) {
  const lower = message.toLowerCase();

  if (
    lower.includes("pain") ||
    lower.includes("injury") ||
    lower.includes("knee") ||
    lower.includes("shoulder") ||
    lower.includes("back pain")
  ) {
    return "Train carefully today. Avoid movements that cause pain, reduce the load, slow the tempo, and choose controlled machine-based exercises. If pain continues or feels sharp, stop and speak to a qualified professional or gym staff before continuing.";
  }

  if (
    lower.includes("20") ||
    lower.includes("short") ||
    lower.includes("quick")
  ) {
    return "Quick session: 5 min warm-up, then 3 rounds of leg press, chest press, seated row and plank. Keep rest to 45 seconds. Finish with 5 minutes easy cardio.";
  }

  if (lower.includes("30")) {
    return "For 30 minutes: warm up for 5 minutes, choose 4 main exercises, complete 3 sets each, then finish with a short core or cardio finisher. Keep it simple and focused.";
  }

  if (lower.includes("harder") || lower.includes("advanced")) {
    return "To make it harder, add one extra set to each main exercise, slow down the lowering phase, reduce rest by 15 seconds, or add a finisher at the end. Do not increase everything at once.";
  }

  if (lower.includes("easier") || lower.includes("beginner")) {
    return "To make it easier, use machines, reduce the weight, do 2 sets instead of 3, and rest longer between sets. Focus on good form before intensity.";
  }

  if (lower.includes("chest")) {
    return "Chest workout: chest press, incline dumbbell press, cable fly, push-ups and tricep pushdowns. Use controlled reps and avoid bouncing the weight.";
  }

  if (lower.includes("legs") || lower.includes("leg")) {
    return "Leg workout: leg press, Romanian deadlift, walking lunges, leg curl, calf raises and a short bike cooldown. Keep knees controlled and do not rush the reps.";
  }

  if (lower.includes("back")) {
    return "Back workout: lat pulldown, seated row, single-arm cable row, face pulls and back extensions. Keep your chest tall and avoid pulling with momentum.";
  }

  if (lower.includes("fat") || lower.includes("weight")) {
    return "For fat loss, combine strength training with short cardio finishers. Keep the weights challenging, rest controlled, and aim for consistency across the week.";
  }

  if (lower.includes("muscle")) {
    return "For muscle growth, focus on controlled reps, progressive overload, and enough recovery. Aim mostly for 8–12 reps and stop each set close to failure without losing form.";
  }

  if (lower.includes("strength")) {
    return "For strength, focus on heavier compound movements, lower reps, longer rest, and clean technique. Do not max out every session.";
  }

  return `Based on your current setup — ${goalLabel(goal)}, ${levelLabel(
    level
  )}, ${minutes} minutes — keep the workout focused, controlled and realistic. Start with a warm-up, complete your main lifts with good form, then finish with core, mobility or light cardio.`;
}

export default function AiTrainer() {
  const [goal, setGoal] = useState<Goal>("fitness");
  const [level, setLevel] = useState<Level>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [style, setStyle] = useState<Style>("balanced");
  const [limitations, setLimitations] = useState("");
  const [generated, setGenerated] = useState(false);
  const [planVersion, setPlanVersion] = useState(0);
  const [savedPlan, setSavedPlan] = useState<SavedWorkoutPlan | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "trainer",
      text: "Hi, I’m your BGM AI Trainer. Generate a plan, then ask me how to adjust it.",
    },
  ]);

  const plan = useMemo(
    () =>
      buildPlan(
        goal,
        level,
        daysPerWeek,
        minutes,
        style,
        limitations,
        planVersion
      ),
    [goal, level, daysPerWeek, minutes, style, limitations, planVersion]
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as SavedWorkoutPlan;
      setSavedPlan(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function saveCurrentPlan() {
    const currentPlan: SavedWorkoutPlan = {
      goal,
      level,
      daysPerWeek,
      minutes,
      style,
      limitations,
      planVersion,
      savedAt: new Date().toISOString(),
      plan,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPlan));
    setSavedPlan(currentPlan);
    setSaveStatus("Plan saved on this device.");
  }

  function loadSavedPlan() {
    if (!savedPlan) return;

    setGoal(savedPlan.goal);
    setLevel(savedPlan.level);
    setDaysPerWeek(savedPlan.daysPerWeek);
    setMinutes(savedPlan.minutes);
    setStyle(savedPlan.style);
    setLimitations(savedPlan.limitations);
    setPlanVersion(savedPlan.planVersion);
    setGenerated(true);
    setSaveStatus("Saved plan loaded.");
  }

  function clearSavedPlan() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSavedPlan(null);
    setSaveStatus("Saved plan cleared.");
  }

  function sendTrainerMessage(messageText?: string) {
    const text = (messageText || chatInput).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    };

    const trainerMessage: ChatMessage = {
      id: `${Date.now()}-trainer`,
      role: "trainer",
      text: buildTrainerReply(text, goal, level, minutes),
    };

    setChatMessages((current) => [...current, userMessage, trainerMessage]);
    setChatInput("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-orange-500/60 bg-black shadow-[0_0_30px_rgba(249,115,22,0.25)]">
            <Image
              src="/bgm-trainer-icon.png"
              alt="BGM AI Trainer"
              fill
              priority
              className="object-cover"
            />
          </div>

          <div>
            <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
                AI Trainer
              </p>
            </div>

            <h1 className="mt-4 text-4xl font-black leading-tight text-white">
              Build your next workout
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-white/55">
          Choose your goal, level and training style. Your BGM trainer will
          generate a simple plan you can follow inside any BestGymsMalta gym.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
          <ShieldAlert
            className="mt-0.5 shrink-0 text-orange-500"
            size={20}
            strokeWidth={3}
          />
          <p className="text-xs font-bold leading-5 text-white/55">
            This is a prototype training guide, not medical advice. Members
            should train within their ability and ask gym staff for help when
            unsure.
          </p>
        </div>
      </section>

      {savedPlan ? (
        <section className="rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Saved Plan
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {goalLabel(savedPlan.goal)} · {levelLabel(savedPlan.level)}
              </h2>
              <p className="mt-2 text-sm font-bold text-white/50">
                {savedPlan.daysPerWeek} days · {savedPlan.minutes} minutes ·{" "}
                {styleLabel(savedPlan.style)}
              </p>
            </div>

            <FileText className="shrink-0 text-orange-500" size={28} strokeWidth={3} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={loadSavedPlan}
              className="rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
            >
              Load Plan
            </button>

            <button
              type="button"
              onClick={clearSavedPlan}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-black text-white"
            >
              <Trash2 size={16} strokeWidth={3} />
              Clear
            </button>
          </div>
        </section>
      ) : null}

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
              max="7"
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
            onClick={() => {
              setGenerated(true);
              setPlanVersion((current) => current + 1);
              setSaveStatus("");
            }}
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
              {daysPerWeek} days per week · {minutes} minutes ·{" "}
              {styleLabel(style)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={saveCurrentPlan}
                className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
              >
                <Save size={16} strokeWidth={3} />
                Save Plan
              </button>

              <button
                type="button"
                onClick={() => setPlanVersion((current) => current + 1)}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-black text-white"
              >
                <RefreshCw size={16} strokeWidth={3} />
                New Version
              </button>
            </div>

            {saveStatus ? (
              <p className="mt-3 text-sm font-bold text-white/50">
                {saveStatus}
              </p>
            ) : null}
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
                {day.exercises.map((exercise, index) => (
                  <div
                    key={`${day.title}-${index}`}
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

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-orange-500/50 bg-black">
            <Image
              src="/bgm-trainer-icon.png"
              alt="BGM Chat Trainer"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Chat Trainer
            </p>
            <h2 className="text-2xl font-black text-white">
              Ask your BGM Trainer
            </h2>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendTrainerMessage(prompt)}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white/55"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl border p-4 ${
                message.role === "trainer"
                  ? "border-orange-500/20 bg-orange-500/10"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <p className="mb-1 text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                {message.role === "trainer" ? "BGM Trainer" : "You"}
              </p>
              <p className="text-sm font-bold leading-6 text-white/65">
                {message.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask about your workout..."
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25"
          />

          <button
            type="button"
            onClick={() => sendTrainerMessage()}
            className="flex shrink-0 items-center justify-center rounded-full bg-orange-500 px-4 text-black"
            aria-label="Send message"
          >
            <Send size={18} strokeWidth={3} />
          </button>
        </div>
      </section>
    </div>
  );
}
