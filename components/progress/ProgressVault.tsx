"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  LogIn,
  RefreshCw,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type ProgressPhoto = {
  id: string;
  imageUrl: string;
  progressDate: string;
  bodyWeight: string;
  photoView: string;
  notes: string;
  createdAt: string;
};

const photoViews = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
  { value: "other", label: "Other" },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString();
}

export default function ProgressVault() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [member, setMember] = useState<AppMember | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progressDate, setProgressDate] = useState(todayString());
  const [bodyWeight, setBodyWeight] = useState("");
  const [photoView, setPhotoView] = useState("front");
  const [notes, setNotes] = useState("");
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedMember = getSavedMember();
    setMember(savedMember);

    if (!savedMember) {
      setLoading(false);
      return;
    }

    loadPhotos(savedMember.id);
  }, []);

  useEffect(() => {
    if (photos.length >= 2) {
      setBeforeId((current) => current || photos[photos.length - 1]?.id || "");
      setAfterId((current) => current || photos[0]?.id || "");
    }
  }, [photos]);

  async function loadPhotos(memberId: string) {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/member/progress-photos?memberId=${memberId}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Could not load progress photos.");
        setPhotos([]);
        return;
      }

      setPhotos(data.photos || []);
    } catch {
      setStatus("Could not load progress photos.");
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  function chooseFile(file?: File) {
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("Photo selected.");
  }

  function clearForm() {
    setSelectedFile(null);
    setPreviewUrl("");
    setProgressDate(todayString());
    setBodyWeight("");
    setPhotoView("front");
    setNotes("");
  }

  async function savePhoto() {
    if (!member) {
      setStatus("Please log in first.");
      return;
    }

    if (!selectedFile) {
      setStatus("Choose a photo first.");
      return;
    }

    setSaving(true);
    setStatus("Uploading progress photo…");

    const formData = new FormData();
    formData.append("memberId", member.id);
    formData.append("progressDate", progressDate);
    formData.append("bodyWeight", bodyWeight);
    formData.append("photoView", photoView);
    formData.append("notes", notes);
    formData.append("photo", selectedFile);

    try {
      const response = await fetch("/api/member/progress-photos", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Could not upload photo.");
        return;
      }

      setStatus(data.message || "Progress photo saved.");
      clearForm();
      await loadPhotos(member.id);
    } catch {
      setStatus("Could not upload photo.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePhoto(photo: ProgressPhoto) {
    if (!member) return;

    const confirmed = window.confirm("Delete this progress photo?");
    if (!confirmed) return;

    setStatus("Deleting photo…");

    try {
      const response = await fetch(
        `/api/member/progress-photos?memberId=${member.id}&photoId=${photo.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Could not delete photo.");
        return;
      }

      setStatus(data.message || "Photo deleted.");
      await loadPhotos(member.id);
    } catch {
      setStatus("Could not delete photo.");
    }
  }

  const beforePhoto = useMemo(
    () => photos.find((photo) => photo.id === beforeId) || null,
    [photos, beforeId]
  );

  const afterPhoto = useMemo(
    () => photos.find((photo) => photo.id === afterId) || null,
    [photos, afterId]
  );

  if (!member) {
    return (
      <section className="rounded-[2rem] border border-orange-500/30 bg-orange-500/10 p-6 text-center">
        <ImagePlus className="mx-auto text-orange-500" size={44} strokeWidth={3} />

        <h1 className="mt-5 text-4xl font-black text-white">
          Progress Vault
        </h1>

        <p className="mt-3 text-sm font-bold leading-6 text-white/55">
          Log in to save private progress photos and compare your before and
          after journey.
        </p>

        <a
          href="/member-login"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          <LogIn size={17} strokeWidth={3} />
          Login / Activate
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            Private Progress Vault
          </p>

          <h1 className="mt-4 text-4xl font-black leading-tight text-white">
            Track your transformation
          </h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Save private progress photos, add notes and compare your before and
            after results.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black text-white">
              {photos.length} saved photo{photos.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs font-bold text-white/40">
              Saved to {member.username || member.fullName}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[.22em] text-orange-500">
          Upload Photo
        </p>

        {previewUrl ? (
          <div className="mt-4 overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
            <img
              src={previewUrl}
              alt="Progress preview"
              className="max-h-[480px] w-full object-cover"
            />
          </div>
        ) : (
          <div className="mt-4 flex min-h-64 items-center justify-center rounded-[2rem] border border-dashed border-white/15 bg-black/25 p-6 text-center">
            <div>
              <ImagePlus className="mx-auto text-white/30" size={44} strokeWidth={3} />
              <p className="mt-3 text-sm font-bold text-white/45">
                Choose a photo from your gallery or camera.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
          >
            <Camera size={17} strokeWidth={3} />
            Camera
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
          >
            <ImagePlus size={17} strokeWidth={3} />
            Gallery
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />

        <div className="mt-5 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Date
              </span>
              <input
                type="date"
                value={progressDate}
                onChange={(event) => setProgressDate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Weight
              </span>
              <input
                value={bodyWeight}
                onChange={(event) => setBodyWeight(event.target.value)}
                placeholder="e.g. 82kg"
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Photo View
            </span>
            <select
              value={photoView}
              onChange={(event) => setPhotoView(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
            >
              {photoViews.map((view) => (
                <option key={view.value} value={view.value}>
                  {view.label}
                </option>
              ))}
            </select>
          </label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes optional"
            className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <button
            type="button"
            onClick={savePhoto}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black disabled:opacity-40"
          >
            {saving ? (
              <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
            ) : (
              <Upload size={17} strokeWidth={3} />
            )}
            Save Progress Photo
          </button>
        </div>
      </section>

      {photos.length >= 2 ? (
        <section className="rounded-[2rem] border border-orange-500/30 bg-orange-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-500">
            Before / After Compare
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/45">
                Before
              </span>
              <select
                value={beforeId}
                onChange={(event) => setBeforeId(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-bold text-white outline-none"
              >
                {photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.progressDate} · {photo.photoView}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/45">
                After
              </span>
              <select
                value={afterId}
                onChange={(event) => setAfterId(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-bold text-white outline-none"
              >
                {photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.progressDate} · {photo.photoView}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {beforePhoto ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
                <div className="bg-black/60 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-500">
                    Before
                  </p>
                  <p className="mt-1 text-xs font-bold text-white/60">
                    {formatDate(beforePhoto.progressDate)}
                    {beforePhoto.bodyWeight ? ` · ${beforePhoto.bodyWeight}` : ""}
                  </p>
                </div>
                <img
                  src={beforePhoto.imageUrl}
                  alt="Before progress"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
            ) : null}

            {afterPhoto ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
                <div className="bg-black/60 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-500">
                    After
                  </p>
                  <p className="mt-1 text-xs font-bold text-white/60">
                    {formatDate(afterPhoto.progressDate)}
                    {afterPhoto.bodyWeight ? ` · ${afterPhoto.bodyWeight}` : ""}
                  </p>
                </div>
                <img
                  src={afterPhoto.imageUrl}
                  alt="After progress"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          {beforePhoto?.bodyWeight && afterPhoto?.bodyWeight ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-3">
                <Scale className="text-orange-500" size={20} strokeWidth={3} />
                <p className="text-sm font-bold text-white/60">
                  Before: {beforePhoto.bodyWeight} · After: {afterPhoto.bodyWeight}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[.22em] text-orange-500">
          Photo Timeline
        </p>

        {loading ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/45">
            <RefreshCw size={18} className="animate-spin" />
            <p className="text-sm font-bold">Loading photos…</p>
          </div>
        ) : null}

        {!loading && photos.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold leading-6 text-white/45">
            No progress photos yet. Upload your first one above.
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25"
            >
              <img
                src={photo.imageUrl}
                alt="Progress"
                className="max-h-[520px] w-full object-cover"
              />

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">
                      {formatDate(photo.progressDate)}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[.18em] text-orange-500">
                      {photo.photoView}
                      {photo.bodyWeight ? ` · ${photo.bodyWeight}` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deletePhoto(photo)}
                    className="rounded-full border border-red-500/30 bg-red-500/10 p-3 text-red-300"
                  >
                    <Trash2 size={16} strokeWidth={3} />
                  </button>
                </div>

                {photo.notes ? (
                  <p className="mt-3 text-sm font-bold leading-6 text-white/50">
                    {photo.notes}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {status ? (
        <p className="text-center text-sm font-bold leading-6 text-white/50">
          {status}
        </p>
      ) : null}
    </div>
  );
}
