"use client";

import { useMemo, useRef, useState } from "react";
import { comingSoonGyms, activeGyms } from "@/components/data/gyms";
import {
  Camera,
  Download,
  Image as ImageIcon,
  Move,
  Share2,
  Smile,
  Sticker,
  Trash2,
} from "lucide-react";

type StickerKind = "logo" | "emoji" | "gym";

type StorySticker = {
  id: string;
  kind: StickerKind;
  label: string;
  value: string;
  x: number;
  y: number;
  size: number;
};

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
};

const emojiOptions = [
  "💪",
  "🔥",
  "🏋️",
  "⚡",
  "🥊",
  "🚴",
  "🏃",
  "✅",
  "❤️",
  "👏",
  "👑",
  "🎯",
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export default function StoryCreator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [photoSrc, setPhotoSrc] = useState("");
  const [stickers, setStickers] = useState<StorySticker[]>([
    {
      id: "default-bgm-logo",
      kind: "logo",
      label: "BGM Logo",
      value: "/bgm-watermark.png",
      x: 50,
      y: 82,
      size: 150,
    },
  ]);
  const [activeStickerId, setActiveStickerId] = useState("default-bgm-logo");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [status, setStatus] = useState("");

  const gymStickerOptions = useMemo(
    () => [...activeGyms, ...comingSoonGyms],
    []
  );

  const activeSticker = stickers.find((sticker) => sticker.id === activeStickerId);

  function handlePhoto(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setPhotoSrc(String(reader.result || ""));
      setStatus("");
    };

    reader.readAsDataURL(file);
  }

  function addLogoSticker() {
    const id = `logo-${Date.now()}`;

    setStickers((current) => [
      ...current,
      {
        id,
        kind: "logo",
        label: "BGM Logo",
        value: "/bgm-watermark.png",
        x: 50,
        y: 75,
        size: 150,
      },
    ]);

    setActiveStickerId(id);
  }

  function addEmojiSticker(emoji: string) {
    const id = `emoji-${Date.now()}`;

    setStickers((current) => [
      ...current,
      {
        id,
        kind: "emoji",
        label: emoji,
        value: emoji,
        x: 50,
        y: 50,
        size: 80,
      },
    ]);

    setActiveStickerId(id);
  }

  function addGymSticker(name: string) {
    const id = `gym-${Date.now()}`;

    setStickers((current) => [
      ...current,
      {
        id,
        kind: "gym",
        label: name,
        value: "/bgm-watermark.png",
        x: 50,
        y: 70,
        size: 170,
      },
    ]);

    setActiveStickerId(id);
  }

  function updateActiveStickerSize(size: number) {
    if (!activeStickerId) return;

    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === activeStickerId ? { ...sticker, size } : sticker
      )
    );
  }

  function removeActiveSticker() {
    if (!activeStickerId) return;

    setStickers((current) =>
      current.filter((sticker) => sticker.id !== activeStickerId)
    );
    setActiveStickerId("");
  }

  function pointerToPercent(event: React.PointerEvent, sticker: StorySticker) {
    const preview = previewRef.current;
    if (!preview) return null;

    const rect = preview.getBoundingClientRect();

    const x =
      ((event.clientX - rect.left - dragState!.offsetX) / rect.width) * 100;
    const y =
      ((event.clientY - rect.top - dragState!.offsetY) / rect.height) * 100;

    return {
      x: Math.min(95, Math.max(5, x)),
      y: Math.min(95, Math.max(5, y)),
    };
  }

  function startDragging(event: React.PointerEvent, sticker: StorySticker) {
    const preview = previewRef.current;
    if (!preview) return;

    const rect = preview.getBoundingClientRect();
    const stickerX = (sticker.x / 100) * rect.width;
    const stickerY = (sticker.y / 100) * rect.height;

    setActiveStickerId(sticker.id);
    setDragState({
      id: sticker.id,
      offsetX: event.clientX - rect.left - stickerX,
      offsetY: event.clientY - rect.top - stickerY,
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragSticker(event: React.PointerEvent, sticker: StorySticker) {
    if (!dragState || dragState.id !== sticker.id) return;

    const position = pointerToPercent(event, sticker);
    if (!position) return;

    setStickers((current) =>
      current.map((item) =>
        item.id === sticker.id
          ? {
              ...item,
              x: position.x,
              y: position.y,
            }
          : item
      )
    );
  }

  function stopDragging() {
    setDragState(null);
  }

  async function renderStoryBlob() {
    if (!photoSrc) {
      setStatus("Choose or take a photo first.");
      return null;
    }

    const preview = previewRef.current;
    if (!preview) return null;

    const previewRect = preview.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const photo = await loadImage(photoSrc);

    const scale = Math.max(canvas.width / photo.width, canvas.height / photo.height);
    const width = photo.width * scale;
    const height = photo.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    context.drawImage(photo, x, y, width, height);

    for (const sticker of stickers) {
      const stickerX = (sticker.x / 100) * canvas.width;
      const stickerY = (sticker.y / 100) * canvas.height;
      const stickerSize = (sticker.size / previewRect.width) * canvas.width;

      if (sticker.kind === "emoji") {
        context.save();
        context.font = `${stickerSize}px Apple Color Emoji, Segoe UI Emoji, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.shadowColor = "rgba(0,0,0,0.45)";
        context.shadowBlur = 18;
        context.fillText(sticker.value, stickerX, stickerY);
        context.restore();
      }

      if (sticker.kind === "logo") {
        try {
          const logo = await loadImage(sticker.value);
          context.save();
          context.shadowColor = "rgba(0,0,0,0.5)";
          context.shadowBlur = 18;
          context.drawImage(
            logo,
            stickerX - stickerSize / 2,
            stickerY - stickerSize / 2,
            stickerSize,
            stickerSize
          );
          context.restore();
        } catch {
          // Ignore missing logo image.
        }
      }

      if (sticker.kind === "gym") {
        const badgeWidth = stickerSize * 1.9;
        const badgeHeight = stickerSize * 0.58;
        const badgeX = stickerX - badgeWidth / 2;
        const badgeY = stickerY - badgeHeight / 2;

        context.save();
        context.shadowColor = "rgba(0,0,0,0.5)";
        context.shadowBlur = 18;

        drawRoundedRect(
          context,
          badgeX,
          badgeY,
          badgeWidth,
          badgeHeight,
          badgeHeight / 2
        );
        context.fillStyle = "rgba(0,0,0,0.72)";
        context.fill();

        context.lineWidth = Math.max(4, stickerSize * 0.035);
        context.strokeStyle = "#f97316";
        context.stroke();

        try {
          const logo = await loadImage(sticker.value);
          const logoSize = badgeHeight * 0.7;
          context.drawImage(
            logo,
            badgeX + badgeHeight * 0.18,
            badgeY + (badgeHeight - logoSize) / 2,
            logoSize,
            logoSize
          );
        } catch {
          // Continue without logo image.
        }

        context.fillStyle = "#ffffff";
        context.font = `900 ${Math.max(24, stickerSize * 0.18)}px Arial, sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(
          sticker.label,
          badgeX + badgeHeight * 0.95,
          stickerY,
          badgeWidth - badgeHeight * 1.15
        );

        context.restore();
      }
    }

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  async function saveStory() {
    const blob = await renderStoryBlob();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bgm-story.png";
    link.click();

    URL.revokeObjectURL(url);
    setStatus("Story image saved.");
  }

  async function shareStory() {
    const blob = await renderStoryBlob();
    if (!blob) return;

    const file = new File([blob], "bgm-story.png", { type: "image/png" });

    const shareNavigator = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    if (shareNavigator.canShare?.({ files: [file] }) && shareNavigator.share) {
      await shareNavigator.share({
        title: "BestGymsMalta Story",
        text: "Created with the BestGymsMalta app",
        files: [file],
      });
      setStatus("Story ready to share.");
      return;
    }

    await saveStory();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
        <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
            Story Creator
          </p>
        </div>

        <h1 className="mt-5 text-4xl font-black leading-tight text-white">
          Create your BGM story
        </h1>

        <p className="mt-4 text-sm leading-6 text-white/55">
          Add the BGM watermark, gym badges and emojis. Move, resize and share
          your story to Instagram, Facebook or TikTok.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          <Camera size={18} strokeWidth={3} />
          Take Photo
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
        >
          <ImageIcon size={18} strokeWidth={3} />
          Gallery
        </button>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handlePhoto(event.target.files?.[0])}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handlePhoto(event.target.files?.[0])}
        />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        <div
          ref={previewRef}
          className="relative mx-auto aspect-[9/16] max-h-[720px] w-full max-w-[420px] overflow-hidden rounded-[2rem] bg-black"
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="Story preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <ImageIcon className="text-white/20" size={56} strokeWidth={2.5} />
              <p className="mt-4 text-sm font-bold leading-6 text-white/45">
                Take or upload a photo to start creating your BGM story.
              </p>
            </div>
          )}

          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onPointerDown={(event) => startDragging(event, sticker)}
              onPointerMove={(event) => dragSticker(event, sticker)}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              className={`absolute z-10 touch-none bg-transparent p-0 ${
                activeStickerId === sticker.id
                  ? "outline outline-2 outline-orange-500"
                  : ""
              }`}
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {sticker.kind === "emoji" ? (
                <span
                  className="block select-none drop-shadow-[0_0_12px_rgba(0,0,0,0.75)]"
                  style={{ fontSize: sticker.size }}
                >
                  {sticker.value}
                </span>
              ) : sticker.kind === "logo" ? (
                <img
                  src={sticker.value}
                  alt={sticker.label}
                  className="select-none drop-shadow-[0_0_12px_rgba(0,0,0,0.75)]"
                  style={{
                    width: sticker.size,
                    height: sticker.size,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <span
                  className="flex select-none items-center gap-2 rounded-full border-2 border-orange-500 bg-black/75 px-3 py-2 text-white shadow-[0_0_18px_rgba(0,0,0,0.5)]"
                  style={{
                    width: sticker.size * 1.9,
                    minHeight: sticker.size * 0.58,
                  }}
                >
                  <img
                    src={sticker.value}
                    alt=""
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <span className="truncate text-sm font-black">
                    {sticker.label}
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.2em] text-white/35">
          <Move size={15} strokeWidth={3} />
          Tap sticker, drag to move
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            Add Stickers
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Logos, emojis and gyms
          </h2>
        </div>

        <button
          type="button"
          onClick={addLogoSticker}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          <Sticker size={18} strokeWidth={3} />
          Add BGM Logo
        </button>

        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white/40">
            <Smile size={15} strokeWidth={3} />
            Emojis
          </p>

          <div className="flex flex-wrap gap-2">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmojiSticker(emoji)}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-2xl"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-white/40">
            Gym Badges
          </p>

          <div className="grid gap-2">
            {gymStickerOptions.map((gym) => (
              <button
                key={gym.id}
                type="button"
                onClick={() => addGymSticker(gym.name)}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left text-sm font-black text-white/65"
              >
                {gym.name}
              </button>
            ))}
          </div>
        </div>

        {activeSticker ? (
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-white/40">
              Resize selected sticker
            </p>

            <input
              type="range"
              min="50"
              max="280"
              value={activeSticker.size}
              onChange={(event) => updateActiveStickerSize(Number(event.target.value))}
              className="mt-4 w-full accent-orange-500"
            />

            <button
              type="button"
              onClick={removeActiveSticker}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
            >
              <Trash2 size={16} strokeWidth={3} />
              Remove Selected Sticker
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={shareStory}
          className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          <Share2 size={18} strokeWidth={3} />
          Share
        </button>

        <button
          type="button"
          onClick={saveStory}
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
        >
          <Download size={18} strokeWidth={3} />
          Save
        </button>
      </section>

      {status ? (
        <p className="text-center text-sm font-bold text-white/45">{status}</p>
      ) : null}
    </div>
  );
}
