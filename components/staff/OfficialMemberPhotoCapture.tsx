"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  applicationMemberId?: string;
  memberId?: string;
  source?: "renewal" | "reception_capture";
  staffName?: string;
  onSaved?: (photoUrl: string) => void;
};

export default function OfficialMemberPhotoCapture({
  applicationMemberId,
  memberId,
  source,
  staffName,
  onSaved,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError("");
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Camera access is required to capture the official member photo.");
    }
  }

  useEffect(() => () => stopCamera(), []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, sx, sy, side, side, 0, 0, 720, 720);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture photo. Please try again.");
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPhotoBlob(blob);
        setPreviewUrl(url);
        stopCamera();
      },
      "image/webp",
      0.86
    );
  }

  async function usePhoto() {
    if (!photoBlob || (!applicationMemberId && !memberId)) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", new File([photoBlob], "official-photo.webp", { type: "image/webp" }));
      if (applicationMemberId) body.set("applicationMemberId", applicationMemberId);
      if (memberId) body.set("memberId", memberId);
      if (source) body.set("source", source);
      if (staffName?.trim()) body.set("staffName", staffName.trim());

      const response = await fetch("/api/system/members/photo", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not save official member photo.");
        return;
      }
      onSaved?.(data.photoUrl || "");
    } catch {
      setError("Could not save official member photo.");
    } finally {
      setBusy(false);
    }
  }

  async function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPhotoBlob(null);
    await startCamera();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="font-bold">Official member photo</p>
      <p className="mt-1 text-sm text-zinc-500">Centre the member&apos;s face clearly. This photo is private and used by reception for identity checks.</p>

      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-4 overflow-hidden rounded-2xl bg-zinc-950 aspect-square max-w-sm">
        {previewUrl ? (
          <img src={previewUrl} alt="Official member photo preview" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!previewUrl && (
          <>
            <button type="button" onClick={startCamera} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold">Open Camera</button>
            <button type="button" onClick={capture} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Take Photo</button>
          </>
        )}
        {previewUrl && (
          <>
            <button type="button" disabled={busy} onClick={usePhoto} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Use Photo"}</button>
            <button type="button" disabled={busy} onClick={retake} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold disabled:opacity-50">Retake</button>
          </>
        )}
      </div>
    </div>
  );
}
