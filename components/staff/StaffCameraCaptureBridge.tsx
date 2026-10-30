"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

type CaptureTarget = HTMLInputElement | null;

export default function StaffCameraCaptureBridge() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const targetInputRef = useRef<CaptureTarget>(null);

  useEffect(() => {
    function interceptTakePhoto(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const label = target?.closest("label");
      if (!label || !label.textContent?.includes("Take Photo")) return;
      const input = label.querySelector('input[type="file"][capture]') as HTMLInputElement | null;
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      targetInputRef.current = input;
      setError("");
      setOpen(true);
    }
    document.addEventListener("click", interceptTakePhoto, true);
    return () => document.removeEventListener("click", interceptTakePhoto, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported by this browser.");
        }
        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(nextStream);
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          await videoRef.current.play();
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not open the camera.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play();
  }, [stream]);

  function close() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setOpen(false);
    setError("");
    targetInputRef.current = null;
  }

  async function capture() {
    const video = videoRef.current;
    const input = targetInputRef.current;
    if (!video || !input || !video.videoWidth || !video.videoHeight) {
      setError("Camera image is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture the camera image.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("Could not capture the camera image.");
      return;
    }
    const file = new File([blob], `staff-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="staff-camera-title" className="w-full max-w-2xl rounded-3xl bg-white p-5 text-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">Staff photo</p>
            <h2 id="staff-camera-title" className="text-xl font-black">Take Photo</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close camera" className="rounded-xl p-2 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} className="rounded-xl border border-zinc-300 px-4 py-2 font-black">Cancel</button>
          <button type="button" onClick={()=>void capture()} disabled={!stream} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 font-black text-white disabled:opacity-50"><Camera className="h-4 w-4" />Capture Photo</button>
        </div>
      </div>
    </div>
  );
}
