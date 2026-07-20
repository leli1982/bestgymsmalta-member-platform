"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  LineChart,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type StrengthEntry = {
  id: string;
  member_id?: string;
  memberId?: string;
  exercise_name?: string;
  exerciseName?: string;
  progress_date?: string;
  progressDate?: string;
  weight_kg?: number | string;
  weightKg?: number | string;
  sets?: number | string;
  reps?: number | string;
  notes?: string | null;
  created_at?: string;
  createdAt?: string;
};

type EntryRow = {
  id: string;
  exerciseName: string;
  customExercise: string;
  progressDate: string;
  weightKg: string;
  sets: string;
  reps: string;
  notes: string;
};

const defaultExercises = [
  "Bench Press",
  "Squat",
  "Deadlift",
  "Leg Press",
  "Shoulder Press",
  "Lat Pulldown",
  "Seated Row",
  "Chest Press",
  "Bicep Curl",
  "Tricep Pushdown",
  "Hip Thrust",
  "Leg Extension",
  "Leg Curl",
  "Calf Raise",
  "Custom Exercise",
];

function safeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newRow(): EntryRow {
  return {
    id: safeId(),
    exerciseName: "Bench Press",
    customExercise: "",
    progressDate: today(),
    weightKg: "",
    sets: "3",
    reps: "10",
    notes: "",
  };
}

function getExerciseName(entry: StrengthEntry) {
  return String(entry.exerciseName || entry.exercise_name || "").trim();
}

function getEntryDate(entry: StrengthEntry) {
  return String(entry.progressDate || entry.progress_date || "");
}

function getWeight(entry: StrengthEntry) {
  return Number(entry.weightKg || entry.weight_kg || 0);
}

function getSets(entry: StrengthEntry) {
  return Number(entry.sets || 0);
}

function getReps(entry: StrengthEntry) {
  return Number(entry.reps || 0);
}

function getVolume(entry: StrengthEntry) {
  return getWeight(entry) * getSets(entry) * getReps(entry);
}

function formatDate(value: string) {
  if (!value) return "No date";

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

function formatShortDate(value: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value % 1 === 0) return String(value);
  return value.toFixed(1);
}

function sortHistory(entries: StrengthEntry[]) {
  return [...entries].sort((a, b) => {
    const dateA = new Date(getEntryDate(a)).getTime();
    const dateB = new Date(getEntryDate(b)).getTime();

    if (dateA !== dateB) return dateA - dateB;

    return String(a.created_at || a.createdAt || "").localeCompare(
      String(b.created_at || b.createdAt || "")
    );
  });
}

function getExerciseHistory(entries: StrengthEntry[], exercise: string) {
  return sortHistory(
    entries.filter((entry) => getExerciseName(entry) === exercise)
  );
}

function GraphModal({
  exercise,
  entries,
  exerciseTabs,
  onExerciseChange,
  onClose,
}: {
  exercise: string;
  entries: StrengthEntry[];
  exerciseTabs: string[];
  onExerciseChange: (exercise: string) => void;
  onClose: () => void;
}) {
  const history = getExerciseHistory(entries, exercise);
  const graphEntries = history.slice(-12);

  const weights = graphEntries.map(getWeight);
  const maxWeight = Math.max(...weights, 1);
  const minWeight = Math.min(...weights, maxWeight);
  const weightRange = Math.max(maxWeight - minWeight, 1);

  const points = graphEntries.map((entry, index) => {
    const x =
      graphEntries.length === 1
        ? 50
        : 8 + (index / (graphEntries.length - 1)) * 84;

    const y = 82 - ((getWeight(entry) - minWeight) / weightRange) * 64;

    return {
      x,
      y,
      entry,
    };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  const first = history[0];
  const latest = history[history.length - 1];

  const firstWeight = first ? getWeight(first) : 0;
  const latestWeight = latest ? getWeight(latest) : 0;
  const bestWeight = Math.max(...history.map(getWeight), 0);
  const bestVolume = Math.max(...history.map(getVolume), 0);

  const improvement =
    firstWeight > 0 ? ((latestWeight - firstWeight) / firstWeight) * 100 : 0;

  const currentIndex = exerciseTabs.indexOf(exercise);

  function cycle(direction: "previous" | "next") {
    if (exerciseTabs.length === 0) return;

    if (currentIndex === -1) {
      onExerciseChange(exerciseTabs[0]);
      return;
    }

    const nextIndex =
      direction === "next"
        ? (currentIndex + 1) % exerciseTabs.length
        : (currentIndex - 1 + exerciseTabs.length) % exerciseTabs.length;

    onExerciseChange(exerciseTabs[nextIndex]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 backdrop-blur-md sm:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
              Progress Graph
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">{exercise}</h2>
            <p className="mt-1 text-sm font-bold text-white/45">
              Each exercise has its own saved timeline.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-112px)] overflow-y-auto p-5">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => cycle("previous")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
            >
              <ChevronLeft size={18} strokeWidth={3} />
            </button>

            <div className="flex flex-1 gap-2 overflow-x-auto">
              {exerciseTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onExerciseChange(tab)}
                  className={
                    tab === exercise
                      ? "shrink-0 rounded-full bg-[#fcb415] px-4 py-3 text-xs font-black text-black"
                      : "shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white/70"
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => cycle("next")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
            >
              <ChevronRight size={18} strokeWidth={3} />
            </button>
          </div>

          {history.length > 0 ? (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <MiniStat
                label="First"
                value={firstWeight ? formatNumber(firstWeight) + "kg" : "-"}
              />
              <MiniStat
                label="Latest"
                value={latestWeight ? formatNumber(latestWeight) + "kg" : "-"}
              />
              <MiniStat
                label="Best"
                value={bestWeight ? formatNumber(bestWeight) + "kg" : "-"}
              />
            </div>
          ) : null}

          {history.length < 2 ? (
            <div className="rounded-[1.5rem] border border-[#fcb415]/20 bg-[#fcb415]/10 p-5 text-center">
              <LineChart className="mx-auto text-[#fcb415]" size={34} />
              <h3 className="mt-3 text-xl font-black text-white">
                Add another {exercise} entry
              </h3>
              <p className="mt-2 text-sm font-bold leading-6 text-white/50">
                This exercise needs at least two records to show a useful graph.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-[1.6rem] border border-white/10 bg-black/35 p-4">
                <svg viewBox="0 0 100 100" className="h-64 w-full overflow-visible">
                  <line
                    x1="8"
                    y1="86"
                    x2="94"
                    y2="86"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1"
                  />
                  <line
                    x1="8"
                    y1="12"
                    x2="8"
                    y2="86"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1"
                  />

                  <polyline
                    points={polyline}
                    fill="none"
                    stroke="#fcb415"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {points.map((point) => (
                    <g key={`${point.x}-${point.y}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="3.2"
                        fill="#fcb415"
                        stroke="black"
                        strokeWidth="1.5"
                      />
                    </g>
                  ))}
                </svg>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black uppercase tracking-[.14em] text-white/35">
                  <span>{formatShortDate(getEntryDate(graphEntries[0]))}</span>
                  <span className="text-right">
                    {formatShortDate(
                      getEntryDate(graphEntries[graphEntries.length - 1])
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat
                  label="Latest"
                  value={latestWeight ? `${formatNumber(latestWeight)}kg` : "-"}
                />
                <MiniStat
                  label="Best"
                  value={bestWeight ? `${formatNumber(bestWeight)}kg` : "-"}
                />
                <MiniStat
                  label="Change"
                  value={`${improvement >= 0 ? "+" : ""}${formatNumber(
                    improvement
                  )}%`}
                />
                <MiniStat
                  label="Best Volume"
                  value={bestVolume ? `${formatNumber(bestVolume)}kg` : "-"}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StrengthTracker() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [entries, setEntries] = useState<StrengthEntry[]>([]);
  const [rows, setRows] = useState<EntryRow[]>([newRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedExercise, setSelectedExercise] = useState("Bench Press");
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    setMember(getSavedMember());
  }, []);

  useEffect(() => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    loadEntries(member.id);
  }, [member?.id]);

  async function loadEntries(memberId: string) {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/member/strength-progress?memberId=${encodeURIComponent(memberId)}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  function updateRow(rowId: string, updates: Partial<EntryRow>) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              ...updates,
            }
          : row
      )
    );
  }

  function removeRow(rowId: string) {
    setRows((currentRows) => {
      if (currentRows.length === 1) return currentRows;
      return currentRows.filter((row) => row.id !== rowId);
    });
  }

  function getRowExercise(row: EntryRow) {
    if (row.exerciseName === "Custom Exercise") {
      return row.customExercise.trim();
    }

    return row.exerciseName;
  }

  async function saveRows() {
    if (!member?.id) return;

    try {
      setSaving(true);

      const payload = rows.map((row) => ({
        exerciseName: getRowExercise(row),
        progressDate: row.progressDate,
        weightKg: row.weightKg,
        sets: row.sets,
        reps: row.reps,
        notes: row.notes,
      }));

      const response = await fetch("/api/member/strength-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member.id,
          entries: payload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save progress.");
      }

      const savedExercises = payload
        .map((item) => item.exerciseName)
        .filter(Boolean);

      if (savedExercises[0]) {
        setSelectedExercise(savedExercises[0]);
      }

      setRows(
        rows.map((row) => ({
          ...row,
          id: safeId(),
          weightKg: "",
          notes: "",
        }))
      );

      await loadEntries(member.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save progress.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!member?.id) return;

    const confirmed = window.confirm("Delete this strength progress entry?");

    if (!confirmed) return;

    try {
      const response = await fetch("/api/member/strength-progress", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member.id,
          entryId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not delete progress entry.");
      }

      await loadEntries(member.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete entry.");
    }
  }

  const loggedExerciseTabs = useMemo(() => {
    const names = entries.map(getExerciseName).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const inputExerciseOptions = useMemo(() => {
    const customSaved = loggedExerciseTabs.filter(
      (exercise) => !defaultExercises.includes(exercise)
    );

    return Array.from(new Set([...defaultExercises, ...customSaved]));
  }, [loggedExerciseTabs]);

  useEffect(() => {
    if (loggedExerciseTabs.length === 0) return;

    if (!loggedExerciseTabs.includes(selectedExercise)) {
      setSelectedExercise(loggedExerciseTabs[0]);
    }
  }, [loggedExerciseTabs, selectedExercise]);

  const activeExercise =
    loggedExerciseTabs.includes(selectedExercise) || loggedExerciseTabs.length === 0
      ? selectedExercise
      : loggedExerciseTabs[0];

  const selectedHistory = useMemo(() => {
    return getExerciseHistory(entries, activeExercise);
  }, [entries, activeExercise]);

  const selectedLatestEntries = useMemo(() => {
    return [...selectedHistory].reverse().slice(0, 8);
  }, [selectedHistory]);

  const allLatestEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => {
        return (
          new Date(getEntryDate(b)).getTime() -
          new Date(getEntryDate(a)).getTime()
        );
      })
      .slice(0, 5);
  }, [entries]);

  const totalEntries = entries.length;
  const totalExercises = loggedExerciseTabs.length;
  const latestForSelected = selectedHistory[selectedHistory.length - 1];
  const firstForSelected = selectedHistory[0];

  const latestWeight = latestForSelected ? getWeight(latestForSelected) : 0;
  const firstWeight = firstForSelected ? getWeight(firstForSelected) : 0;
  const bestForSelected = Math.max(...selectedHistory.map(getWeight), 0);
  const selectedChange =
    firstWeight > 0 ? ((latestWeight - firstWeight) / firstWeight) * 100 : 0;

  if (!member) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
        <LockMessage />
      </section>
    );
  }

  return (
    <>
      <section className="space-y-5 rounded-[2.2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
              Strength Tracker
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">
              Track your lifts
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-white/50">
              Every exercise is saved separately to your own member account.
            </p>
          </div>

          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
            <Dumbbell size={30} strokeWidth={3} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Entries" value={String(totalEntries)} />
          <MiniStat label="Exercises" value={String(totalExercises)} />
          <MiniStat
            label="Selected Best"
            value={bestForSelected ? `${formatNumber(bestForSelected)}kg` : "-"}
          />
        </div>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="rounded-[1.7rem] border border-white/10 bg-black/25 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">
                  Exercise {index + 1}
                </p>

                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-300"
                  >
                    <Trash2 size={16} strokeWidth={3} />
                  </button>
                ) : null}
              </div>

              <label className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                Date
              </label>

              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3">
                <CalendarDays size={18} className="text-white/35" />
                <input
                  type="date"
                  value={row.progressDate}
                  onChange={(event) =>
                    updateRow(row.id, {
                      progressDate: event.target.value,
                    })
                  }
                  className="w-full bg-transparent text-sm font-black text-white outline-none"
                />
              </div>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                Exercise
              </label>

              <div className="relative mt-2">
                <select
                  value={row.exerciseName}
                  onChange={(event) =>
                    updateRow(row.id, {
                      exerciseName: event.target.value,
                    })
                  }
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-black text-white outline-none"
                >
                  {inputExerciseOptions.map((exercise) => (
                    <option key={exercise} value={exercise}>
                      {exercise}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={18}
                />
              </div>

              {row.exerciseName === "Custom Exercise" ? (
                <input
                  value={row.customExercise}
                  onChange={(event) =>
                    updateRow(row.id, {
                      customExercise: event.target.value,
                    })
                  }
                  placeholder="Type exercise name"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-black text-white outline-none placeholder:text-white/25"
                />
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-3">
                <NumberField
                  label="Weight kg"
                  value={row.weightKg}
                  onChange={(value) => updateRow(row.id, { weightKg: value })}
                />

                <NumberField
                  label="Sets"
                  value={row.sets}
                  onChange={(value) => updateRow(row.id, { sets: value })}
                />

                <NumberField
                  label="Reps"
                  value={row.reps}
                  onChange={(value) => updateRow(row.id, { reps: value })}
                />
              </div>

              <input
                value={row.notes}
                onChange={(event) =>
                  updateRow(row.id, {
                    notes: event.target.value,
                  })
                }
                placeholder="Notes, optional"
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRows((currentRows) => [...currentRows, newRow()])}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
          >
            <Plus size={17} strokeWidth={3} />
            Add Exercise
          </button>

          <button
            type="button"
            onClick={saveRows}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-60"
          >
            {saving ? (
              <RefreshCw size={17} className="animate-spin" strokeWidth={3} />
            ) : (
              <Save size={17} strokeWidth={3} />
            )}
            Save
          </button>
        </div>

        <div className="rounded-[1.7rem] border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#fcb415]">
                Exercise Progress
              </p>
              <h3 className="mt-1 text-xl font-black text-white">
                Choose an exercise
              </h3>
              <p className="mt-1 text-sm font-bold text-white/45">
                Stats and graphs change per exercise.
              </p>
            </div>

            <Activity className="text-[#fcb415]" size={26} strokeWidth={3} />
          </div>

          {loggedExerciseTabs.length > 0 ? (
            <>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {loggedExerciseTabs.map((exercise) => (
                  <button
                    key={exercise}
                    type="button"
                    onClick={() => setSelectedExercise(exercise)}
                    className={
                      activeExercise === exercise
                        ? "shrink-0 rounded-full bg-[#fcb415] px-4 py-3 text-xs font-black text-black"
                        : "shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white/70"
                    }
                  >
                    {exercise}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat
                  label="Latest"
                  value={latestWeight ? `${formatNumber(latestWeight)}kg` : "-"}
                />
                <MiniStat
                  label="Best"
                  value={bestForSelected ? `${formatNumber(bestForSelected)}kg` : "-"}
                />
                <MiniStat
                  label="Change"
                  value={
                    selectedHistory.length > 1
                      ? `${selectedChange >= 0 ? "+" : ""}${formatNumber(
                          selectedChange
                        )}%`
                      : "-"
                  }
                />
              </div>

              <button
                type="button"
                onClick={() => setShowGraph(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
              >
                <BarChart3 size={18} strokeWidth={3} />
                View Progress Graphs
              </button>
            </>
          ) : (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm font-bold text-white/45">
              Save your first exercise to unlock exercise tabs and graphs.
            </p>
          )}
        </div>

        <div className="rounded-[1.7rem] border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-white">
                {loggedExerciseTabs.length > 0
                  ? `${activeExercise} history`
                  : "Latest lifts"}
              </h3>
              <p className="mt-1 text-sm font-bold text-white/45">
                {loggedExerciseTabs.length > 0
                  ? "Showing entries for the selected exercise only."
                  : "Your recent strength entries will show here."}
              </p>
            </div>

            {loading ? (
              <RefreshCw className="animate-spin text-white/35" size={18} />
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {(loggedExerciseTabs.length > 0
              ? selectedLatestEntries
              : allLatestEntries
            ).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415]/10 text-[#fcb415]">
                  <Dumbbell size={22} strokeWidth={3} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    {getExerciseName(entry)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-white/45">
                    {formatDate(getEntryDate(entry))} ·{" "}
                    {formatNumber(getWeight(entry))}kg · {getSets(entry)} sets ×{" "}
                    {getReps(entry)} reps
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-300"
                >
                  <Trash2 size={16} strokeWidth={3} />
                </button>
              </div>
            ))}

            {!loading &&
            (loggedExerciseTabs.length > 0
              ? selectedLatestEntries.length === 0
              : allLatestEntries.length === 0) ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm font-bold text-white/45">
                No strength progress yet. Add your first lift above.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {showGraph && loggedExerciseTabs.length > 0 ? (
        <GraphModal
          exercise={activeExercise}
          entries={entries}
          exerciseTabs={loggedExerciseTabs}
          onExerciseChange={setSelectedExercise}
          onClose={() => setShowGraph(false)}
        />
      ) : null}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-3 py-4 text-center text-sm font-black text-white outline-none"
      />
    </div>
  );
}

function LockMessage() {
  return (
    <>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fcb415]/10 text-[#fcb415]">
        <Dumbbell size={30} strokeWidth={3} />
      </div>
      <h2 className="mt-4 text-2xl font-black text-white">Strength Tracker</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-white/50">
        Log in to track your lifts, sets, reps and exercise progress.
      </p>
      <a
        href="/member-login"
        className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
      >
        Login / Activate
      </a>
    </>
  );
}
