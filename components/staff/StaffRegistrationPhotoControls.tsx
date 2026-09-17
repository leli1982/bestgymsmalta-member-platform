"use client";

import { useRef, useState, type ChangeEvent } from "react";
import LivePhotoCapture from "@/components/membership/LivePhotoCapture";

export type StaffRegistrationPhotoControlsProps = {
  existingPhotoUrl?: string | null;
  onCaptured(file: File): void;
  onUploaded(file: File): void;
  onPhotoLater(): void;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function toWebp(file: File): Promise<File> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onerror = () => reject(new Error("Could not open that image."));
    next.onload = () => resolve(next);
    next.src = dataUrl;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare that image.");
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not convert that image."))),
      "image/webp",
      0.88,
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "member-photo";
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

export default function StaffRegistrationPhotoControls({
  existingPhotoUrl,
  onCaptured,
  onUploaded,
  onPhotoLater,
}: StaffRegistrationPhotoControlsProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"choice" | "camera">("choice");
  const [status, setStatus] = useState(existingPhotoUrl ? "Existing photo will be kept unless replaced." : "No photo selected yet.");
  const [error, setError] = useState("");

  function useCaptured(file: File) {
    setError("");
    setStatus("New camera photo selected.");
    onCaptured(file);
    setMode("choice");
  }

  async function chooseUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setError("");
      const webp = await toWebp(file);
      onUploaded(webp);
      setStatus("Uploaded image selected and converted to WebP.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not use that image.");
    }
  }

  function chooseLater() {
    setError("");
    setStatus(existingPhotoUrl ? "Existing photo will be kept." : "Photo Later selected. Reception can add it after registration.");
    onPhotoLater();
    setMode("choice");
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("camera")} className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">
          Take Photo
        </button>
        <button type="button" onClick={() => uploadRef.current?.click()} className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-950">
          Upload Image
        </button>
        <button type="button" onClick={chooseLater} className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-700">
          Photo Later
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={chooseUpload}
          className="hidden"
        />
      </div>

      {mode === "camera" ? (
        <div className="mt-4">
          <LivePhotoCapture label="Take membership photo" required={false} onUsePhoto={useCaptured} />
        </div>
      ) : null}

      <p className="mt-3 text-xs font-semibold text-zinc-600">{status}</p>
      {error ? <p className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
