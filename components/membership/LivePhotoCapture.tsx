"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  required: boolean;
  onUsePhoto: (file: File) => void;
};

export default function LivePhotoCapture({ label, required, onUsePhoto }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [accepted, setAccepted] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPhotoBlob(null);
    setAccepted(false);
  }

  async function startCamera() {
    setCameraError("");
    stopCamera();
    clearPreview();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available on this device. Please speak to reception.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Camera access is required for this application. Allow camera access and try again.");
    }
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Please try again.");
      return;
    }

    const side = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - side) / 2;
    const sourceY = (video.videoHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture the photo. Please try again.");
      return;
    }

    context.drawImage(video, sourceX, sourceY, side, side, 0, 0, 720, 720);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not capture the photo. Please try again.");
          return;
        }
        stopCamera();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPhotoBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setAccepted(false);
      },
      "image/webp",
      0.86,
    );
  }

  function usePhoto() {
    if (!photoBlob) return;
    const file = new File([photoBlob], "membership-photo.webp", { type: "image/webp" });
    onUsePhoto(file);
    setAccepted(true);
  }

  async function retake() {
    clearPreview();
    await startCamera();
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-zinc-950">{label}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Take a clear live photo facing the camera. Gallery uploads are not used for membership registration.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
          {required ? "Required" : "Optional"}
        </span>
      </div>

      {cameraError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          <p>{cameraError}</p>
          <button
            type="button"
            onClick={startCamera}
            className="mt-3 rounded-xl bg-red-700 px-4 py-2 font-black text-white"
          >
            Try Camera Again
          </button>
        </div>
      )}

      <div className="mt-4 aspect-square max-w-sm overflow-hidden rounded-3xl bg-zinc-950">
        {previewUrl ? (
          <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!cameraOpen && !previewUrl && !cameraError && (
          <button
            type="button"
            onClick={startCamera}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-black text-zinc-900"
          >
            Open Camera
          </button>
        )}
        {cameraOpen && !previewUrl && (
          <button
            type="button"
            onClick={takePhoto}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-black text-white"
          >
            Take Photo
          </button>
        )}
        {previewUrl && (
          <>
            <button
              type="button"
              onClick={usePhoto}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white"
            >
              {accepted ? "Photo Ready" : "Use Photo"}
            </button>
            <button
              type="button"
              onClick={retake}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-black text-zinc-900"
            >
              Retake
            </button>
          </>
        )}
      </div>
    </section>
  );
}
