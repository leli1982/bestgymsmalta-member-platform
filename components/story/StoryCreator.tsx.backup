"use client";

import { useRef, useState } from "react";
import { Camera, Download, ImagePlus, Move, Share2 } from "lucide-react";

const WATERMARK_SRC = "/bgm-watermark.png";

type WatermarkState = {
  x: number;
  y: number;
  size: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number
) {
  const imageRatio = img.width / img.height;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let x = 0;
  let y = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imageRatio;
    x = (canvasWidth - drawWidth) / 2;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imageRatio;
    y = (canvasHeight - drawHeight) / 2;
  }

  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

export default function StoryCreator() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<WatermarkState>({
    x: 50,
    y: 78,
    size: 34,
  });
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);

  function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextUrl = URL.createObjectURL(file);
    setPhotoUrl(nextUrl);
  }

  function updateWatermarkPosition(clientX: number, clientY: number) {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    setWatermark((current) => ({
      ...current,
      x: clamp(x, 8, 92),
      y: clamp(y, 8, 92),
    }));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    updateWatermarkPosition(event.clientX, event.clientY);
  }

  async function exportStory() {
    if (!photoUrl || exporting) return;

    setExporting(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const photo = await loadImage(photoUrl);
      const watermarkImage = await loadImage(WATERMARK_SRC);

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawCoverImage(ctx, photo, canvas.width, canvas.height);

      const watermarkWidth = canvas.width * (watermark.size / 100);
      const watermarkHeight =
        watermarkWidth * (watermarkImage.height / watermarkImage.width);

      const watermarkX = canvas.width * (watermark.x / 100) - watermarkWidth / 2;
      const watermarkY =
        canvas.height * (watermark.y / 100) - watermarkHeight / 2;

      ctx.drawImage(
        watermarkImage,
        watermarkX,
        watermarkY,
        watermarkWidth,
        watermarkHeight
      );

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const file = new File([blob], "bestgymsmalta-story.png", {
          type: "image/png",
        });

        const canShare =
          typeof navigator !== "undefined" &&
          "canShare" in navigator &&
          navigator.canShare?.({ files: [file] });

        if (canShare) {
          await navigator.share({
            title: "BestGymsMalta Story",
            text: "Be the best.... Beat the rest",
            files: [file],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "bestgymsmalta-story.png";
          link.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black transition active:scale-95">
        <ImagePlus size={20} strokeWidth={3} />
        Choose Photo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />
      </label>

      <div
        ref={frameRef}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl"
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Selected story"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="rounded-3xl bg-orange-500/10 p-5 text-orange-500">
              <Camera size={42} strokeWidth={3} />
            </div>
            <h2 className="mt-5 text-2xl font-black text-white">
              Add your gym photo
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Upload a photo, then move and resize the official BGM watermark.
            </p>
          </div>
        )}

        {photoUrl ? (
          <button
  type="button"
  onPointerDown={(event) => {
    setDragging(true);
    updateWatermarkPosition(event.clientX, event.clientY);
  }}
  className="absolute z-10 touch-none bg-transparent p-0"
  style={{
    left: `${watermark.x}%`,
    top: `${watermark.y}%`,
    width: `${watermark.size}%`,
    transform: "translate(-50%, -50%)",
  }}
  aria-label="Move BGM watermark"
>
  <img
    src={WATERMARK_SRC}
    alt="BGM watermark"
    draggable={false}
    className="w-full select-none drop-shadow-[0_0_12px_rgba(0,0,0,0.65)]"
  />
</button>
        ) : null}

        {photoUrl ? (
          <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white backdrop-blur">
            <Move className="mr-1 inline" size={14} />
            Drag logo
          </div>
        ) : null}
      </div>

      {photoUrl ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Watermark Size
              </p>
              <p className="mt-1 text-sm font-bold text-white/45">
                Resize the official BGM logo
              </p>
            </div>

            <p className="text-xl font-black text-white">{watermark.size}%</p>
          </div>

          <input
            type="range"
            min="18"
            max="55"
            value={watermark.size}
            onChange={(event) =>
              setWatermark((current) => ({
                ...current,
                size: Number(event.target.value),
              }))
            }
            className="mt-5 w-full accent-orange-500"
          />
        </div>
      ) : null}

      {photoUrl ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={exportStory}
            className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black transition active:scale-95"
          >
            <Share2 size={18} strokeWidth={3} />
            {exporting ? "Preparing..." : "Share"}
          </button>

          <button
            type="button"
            onClick={exportStory}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white transition active:scale-95"
          >
            <Download size={18} strokeWidth={3} />
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}