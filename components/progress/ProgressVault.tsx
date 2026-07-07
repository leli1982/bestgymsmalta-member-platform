"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronRight,
  Download,
  Eye,
  ImagePlus,
  Lock,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type ProgressPhoto = {
  id: string;
  photoUrl?: string;
  photo_url?: string;
  signedUrl?: string;
  signed_url?: string;
  url?: string;
  progressDate?: string;
  progress_date?: string;
  bodyWeight?: string;
  body_weight?: string;
  photoView?: string;
  photo_view?: string;
  notes?: string;
  createdAt?: string;
  created_at?: string;
};

const photoViews = ["front", "side", "back", "other"];

function getPhotoUrl(photo: ProgressPhoto) {
  return (
    photo.photoUrl ||
    photo.photo_url ||
    photo.signedUrl ||
    photo.signed_url ||
    photo.url ||
    ""
  );
}

function getPhotoDate(photo: ProgressPhoto) {
  return photo.progressDate || photo.progress_date || photo.createdAt || photo.created_at || "";
}

function getPhotoWeight(photo: ProgressPhoto) {
  return photo.bodyWeight || photo.body_weight || "";
}

function getPhotoView(photo: ProgressPhoto) {
  return photo.photoView || photo.photo_view || "front";
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

function daysBetween(first?: string, last?: string) {
  if (!first || !last) return 0;

  const start = new Date(first).getTime();
  const end = new Date(last).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

export default function ProgressVault() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progressDate, setProgressDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [bodyWeight, setBodyWeight] = useState("");
  const [photoView, setPhotoView] = useState("front");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const dateA = new Date(getPhotoDate(a)).getTime();
      const dateB = new Date(getPhotoDate(b)).getTime();

      return dateB - dateA;
    });
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (filter === "all") return sortedPhotos;
    return sortedPhotos.filter((photo) => getPhotoView(photo) === filter);
  }, [sortedPhotos, filter]);

  const oldestPhoto = sortedPhotos[sortedPhotos.length - 1];
  const latestPhoto = sortedPhotos[0];

  const trackedDays = daysBetween(
    oldestPhoto ? getPhotoDate(oldestPhoto) : "",
    latestPhoto ? getPhotoDate(latestPhoto) : ""
  );

  useEffect(() => {
    const savedMember = getSavedMember();
    setMember(savedMember);
  }, []);

  useEffect(() => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    loadPhotos(member.id);
  }, [member?.id]);

  function handleFile(file?: File) {
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function loadPhotos(memberId: string) {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/member/progress-photos?memberId=${encodeURIComponent(memberId)}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setPhotos(data.photos || []);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  async function savePhoto() {
    if (!member?.id || !selectedFile) return;

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("memberId", member.id);
      formData.append("progressDate", progressDate);
      formData.append("bodyWeight", bodyWeight);
      formData.append("photoView", photoView);
      formData.append("notes", notes);
      formData.append("photo", selectedFile);

      const response = await fetch("/api/member/progress-photos", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save progress photo.");
      }

      setSelectedFile(null);
      setPreviewUrl("");
      setBodyWeight("");
      setNotes("");
      setPhotoView("front");
      setProgressDate(new Date().toISOString().slice(0, 10));

      await loadPhotos(member.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save photo.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!member?.id) return;

    const confirmed = window.confirm("Delete this progress photo?");

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/member/progress-photos?memberId=${encodeURIComponent(
          member.id
        )}&photoId=${encodeURIComponent(photoId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId: member.id,
            photoId,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not delete photo.");
      }

      await loadPhotos(member.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete photo.");
    }
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <section
          className="relative min-h-[360px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.82)), url('/visuals/progress.jpg')",
          }}
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

          <div className="relative flex min-h-[310px] flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  Progress Vault
                </p>
              </div>

              <Lock className="text-[#fcb415]" size={28} strokeWidth={3} />
            </div>

            <div>
              <h1 className="text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
                Your private progress space
              </h1>

              <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
                Log in to save private progress photos and track your journey.
              </p>

              <a
                href="/member-login"
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
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
    <div className="space-y-6">
      <section
        className="relative min-h-[390px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.82)), url('/visuals/progress.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/25 to-black/85" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative flex min-h-[340px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Progress Vault
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/35 text-[#fcb415] backdrop-blur-md">
              <Camera size={24} strokeWidth={3} />
            </div>
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[.24em] text-[#fcb415]">
              Private. Personal. Powerful.
            </p>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Track your journey
            </h1>

            <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
              Save progress photos, compare your first and latest updates, and
              build your transformation timeline.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <p className="text-3xl font-black text-white">{photos.length}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/40">
                  Photos
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <p className="text-3xl font-black text-[#fcb415]">
                  {trackedDays}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/40">
                  Days
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <p className="text-3xl font-black text-white">
                  {latestPhoto ? formatDate(getPhotoDate(latestPhoto)).slice(0, 2) : "0"}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/40">
                  Latest
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 shrink-0 text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Private Vault
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              Only visible to you
            </h2>

            <p className="mt-3 text-sm font-bold leading-6 text-white/60">
              Your progress photos are not public, not posted to other members,
              and not shared unless you choose to create a story yourself.
            </p>
          </div>
        </div>
      </section>

      {photos.length === 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
          <Sparkles className="mx-auto text-[#fcb415]" size={42} strokeWidth={3} />

          <h2 className="mt-4 text-3xl font-black text-white">
            Start your progress journey
          </h2>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Your first photo is not about where you are today. It gives your
            future self something powerful to compare against.
          </p>
        </section>
      ) : null}

      {oldestPhoto && latestPhoto && oldestPhoto.id !== latestPhoto.id ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Before / Latest
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Compare your journey
              </h2>
            </div>

            <Eye className="text-[#fcb415]" size={25} strokeWidth={3} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25">
              <div
                className="aspect-[3/4] bg-cover bg-center"
                style={{
                  backgroundImage: `url('${getPhotoUrl(oldestPhoto)}')`,
                }}
              />
              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/35">
                  First
                </p>
                <p className="mt-1 text-xs font-bold text-white/65">
                  {formatDate(getPhotoDate(oldestPhoto))}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-[#fcb415]/30 bg-black/25">
              <div
                className="aspect-[3/4] bg-cover bg-center"
                style={{
                  backgroundImage: `url('${getPhotoUrl(latestPhoto)}')`,
                }}
              />
              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#fcb415]">
                  Latest
                </p>
                <p className="mt-1 text-xs font-bold text-white/65">
                  {formatDate(getPhotoDate(latestPhoto))}
                </p>
              </div>
            </div>
          </div>

          <a
            href="/story"
            className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            Create Progress Story
            <ChevronRight size={17} strokeWidth={3} />
          </a>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <ImagePlus className="text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Progress Check-In
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              Add a new photo
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm font-bold leading-6 text-white/45">
          Same lighting. Same angle. Same effort. Small updates become big
          progress over time.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            <Camera size={17} strokeWidth={3} />
            Take Photo
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
          >
            <Upload size={17} strokeWidth={3} />
            Upload
          </button>
        </div>

        {previewUrl ? (
          <div className="mt-5 overflow-hidden rounded-[1.8rem] border border-[#fcb415]/25 bg-black/25">
            <img src={previewUrl} alt="" className="max-h-[420px] w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Date
            </span>
            <input
              type="date"
              value={progressDate}
              onChange={(event) => setProgressDate(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              View
            </span>
            <select
              value={photoView}
              onChange={(event) => setPhotoView(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none"
            >
              {photoViews.map((view) => (
                <option key={view} value={view}>
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Body weight
            </span>
            <input
              value={bodyWeight}
              onChange={(event) => setBodyWeight(event.target.value)}
              placeholder="Example: 82kg"
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="How did you feel today?"
              rows={3}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/25"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={savePhoto}
          disabled={!selectedFile || saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Download size={17} strokeWidth={3} />
              Save to Private Vault
            </>
          )}
        </button>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Timeline
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              Your progress photos
            </h2>
          </div>

          {loading ? (
            <RefreshCw className="animate-spin text-[#fcb415]" size={24} strokeWidth={3} />
          ) : null}
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {["all", ...photoViews].map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setFilter(view)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[.14em] ${
                filter === view
                  ? "bg-[#fcb415] text-black"
                  : "border border-white/10 bg-black/25 text-white/45"
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {filteredPhotos.map((photo) => {
            const url = getPhotoUrl(photo);

            return (
              <article
                key={photo.id}
                className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/25"
              >
                {url ? (
                  <img src={url} alt="" className="max-h-[520px] w-full object-cover" />
                ) : null}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#fcb415]">
                        {getPhotoView(photo)}
                      </p>

                      <h3 className="mt-1 text-xl font-black text-white">
                        {formatDate(getPhotoDate(photo))}
                      </h3>

                      {getPhotoWeight(photo) ? (
                        <p className="mt-1 text-sm font-bold text-white/45">
                          Weight: {getPhotoWeight(photo)}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => deletePhoto(photo.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-200"
                    >
                      <Trash2 size={17} strokeWidth={3} />
                    </button>
                  </div>

                  {photo.notes ? (
                    <p className="mt-3 text-sm font-bold leading-6 text-white/55">
                      {photo.notes}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!loading && filteredPhotos.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5 text-center">
              <Camera className="mx-auto text-[#fcb415]" size={34} strokeWidth={3} />
              <p className="mt-3 text-sm font-bold text-white/45">
                No progress photos in this view yet.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {photos.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="text-[#fcb415]" size={24} strokeWidth={3} />

            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Milestones
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Keep showing up
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-black text-white">
                First progress photo saved
              </p>
              <p className="mt-1 text-xs font-bold text-white/45">
                You started your visual progress journey.
              </p>
            </div>

            {photos.length >= 3 ? (
              <div className="rounded-2xl border border-[#fcb415]/25 bg-[#fcb415]/10 p-4">
                <p className="text-sm font-black text-white">
                  Consistency building
                </p>
                <p className="mt-1 text-xs font-bold text-white/45">
                  You have saved {photos.length} progress photos.
                </p>
              </div>
            ) : null}

            {trackedDays >= 30 ? (
              <div className="rounded-2xl border border-[#fcb415]/25 bg-[#fcb415]/10 p-4">
                <p className="text-sm font-black text-white">
                  30-day journey
                </p>
                <p className="mt-1 text-xs font-bold text-white/45">
                  You have been tracking progress for {trackedDays} days.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
