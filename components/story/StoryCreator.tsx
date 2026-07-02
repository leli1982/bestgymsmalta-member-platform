"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { activeGyms, comingSoonGyms, type Gym } from "@/components/data/gyms";
import {
  Camera,
  Download,
  Dumbbell,
  Image as ImageIcon,
  Move,
  Plus,
  Share2,
  Smile,
  Sticker,
  Trash2,
  Type,
  X,
} from "lucide-react";

type StickerKind = "image" | "emoji" | "text";

type StickerCategory = "brands" | "gyms" | "emojis" | "text" | null;

type StorySticker = {
  id: string;
  kind: StickerKind;
  label: string;
  value: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
};

type Point = {
  x: number;
  y: number;
};

type GestureState = {
  id: string;
  startSticker: StorySticker;
  startCenter: Point;
  startDistance: number;
  startAngle: number;
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
  "💯",
  "😤",
  "🙌",
  "📸",
];

const presetCaptions = [
  "Leg Day",
  "Push Day",
  "Pull Day",
  "New PB",
  "Back at it",
  "No excuses",
  "Workout done",
  "Be the best",
  "Beat the rest",
  "Strong session",
  "BGM Check-in",
  "TSM fuelled",
];

const brandStickerOptions = [
  {
    label: "BGM Logo",
    value: "/bgm-watermark.png",
  },
  {
    label: "Top Supplements Malta",
    value: "/brand-logos/tsm.png",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getCenter(points: Point[]) {
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function getDistance(points: Point[]) {
  if (points.length < 2) return 1;

  const [a, b] = points;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getAngle(points: Point[]) {
  if (points.length < 2) return 0;

  const [a, b] = points;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export default function StoryCreator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<GestureState | null>(null);

  const [photoSrc, setPhotoSrc] = useState("");
  const [stickers, setStickers] = useState<StorySticker[]>([
    {
      id: "default-bgm-logo",
      kind: "image",
      label: "BGM Logo",
      value: "/bgm-watermark.png",
      x: 50,
      y: 82,
      size: 150,
      rotation: 0,
    },
  ]);
  const [activeStickerId, setActiveStickerId] = useState("default-bgm-logo");
  const [openCategory, setOpenCategory] = useState<StickerCategory>(null);
  const [customCaption, setCustomCaption] = useState("");
  const [status, setStatus] = useState("");

  const gymStickerOptions = useMemo(
    () => [...activeGyms, ...comingSoonGyms],
    []
  );

  const activeSticker = stickers.find(
    (sticker) => sticker.id === activeStickerId
  );

  function getPointerList() {
    return Array.from(activePointersRef.current.values());
  }

  function resetGesture(sticker: StorySticker) {
    const points = getPointerList();

    if (!points.length) {
      gestureRef.current = null;
      return;
    }

    gestureRef.current = {
      id: sticker.id,
      startSticker: { ...sticker },
      startCenter: getCenter(points),
      startDistance: Math.max(1, getDistance(points)),
      startAngle: getAngle(points),
    };
  }

  function handlePhoto(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setPhotoSrc(String(reader.result || ""));
      setStatus("");
    };

    reader.readAsDataURL(file);
  }

  function addImageSticker(label: string, value: string) {
    const id = `image-${Date.now()}`;

    setStickers((current) => [
      ...current,
      {
        id,
        kind: "image",
        label,
        value,
        x: 50,
        y: 70,
        size: 150,
        rotation: 0,
      },
    ]);

    setActiveStickerId(id);
    setOpenCategory(null);
  }

  function addGymSticker(gym: Gym) {
    const id = `gym-${Date.now()}`;

    setStickers((current) => [
      ...current,
      {
        id,
        kind: "image",
        label: gym.name,
        value: gym.logo || "/bgm-watermark.png",
        x: 50,
        y: 70,
        size: 170,
        rotation: 0,
      },
    ]);

    setActiveStickerId(id);
    setOpenCategory(null);
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
        rotation: 0,
      },
    ]);

    setActiveStickerId(id);
    setOpenCategory(null);
  }

  function addTextSticker(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    const id = `text-${Date.now()}`;

    setStickers((current) => [
      ...current,
      {
        id,
        kind: "text",
        label: cleanText,
        value: cleanText,
        x: 50,
        y: 50,
        size: 44,
        rotation: 0,
      },
    ]);

    setActiveStickerId(id);
    setCustomCaption("");
    setOpenCategory(null);
  }

  function removeActiveSticker() {
    if (!activeStickerId) return;

    setStickers((current) =>
      current.filter((sticker) => sticker.id !== activeStickerId)
    );
    setActiveStickerId("");
  }

  function resetActiveStickerRotation() {
    if (!activeStickerId) return;

    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === activeStickerId ? { ...sticker, rotation: 0 } : sticker
      )
    );
  }

  function startGesture(
    event: PointerEvent<HTMLButtonElement>,
    sticker: StorySticker
  ) {
    event.preventDefault();

    if (gestureRef.current?.id && gestureRef.current.id !== sticker.id) {
      activePointersRef.current.clear();
    }

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    setActiveStickerId(sticker.id);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers may already have capture.
    }

    const latestSticker =
      stickers.find((item) => item.id === sticker.id) || sticker;

    resetGesture(latestSticker);
  }

  function moveGesture(
    event: PointerEvent<HTMLButtonElement>,
    sticker: StorySticker
  ) {
    event.preventDefault();

    if (!activePointersRef.current.has(event.pointerId)) return;

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const preview = previewRef.current;
    const gesture = gestureRef.current;
    const points = getPointerList();

    if (!preview || !gesture || gesture.id !== sticker.id || !points.length) {
      return;
    }

    const rect = preview.getBoundingClientRect();
    const center = getCenter(points);

    const deltaX = ((center.x - gesture.startCenter.x) / rect.width) * 100;
    const deltaY = ((center.y - gesture.startCenter.y) / rect.height) * 100;

    let nextSize = gesture.startSticker.size;
    let nextRotation = gesture.startSticker.rotation;

    if (points.length >= 2) {
      const distance = Math.max(1, getDistance(points));
      const scale = distance / gesture.startDistance;
      const angle = getAngle(points);
      const angleChange = radiansToDegrees(angle - gesture.startAngle);

      nextSize = clamp(
        gesture.startSticker.size * scale,
        sticker.kind === "text" ? 20 : 40,
        sticker.kind === "text" ? 110 : 360
      );
      nextRotation = gesture.startSticker.rotation + angleChange;
    }

    setStickers((current) =>
      current.map((item) =>
        item.id === sticker.id
          ? {
              ...item,
              x: clamp(gesture.startSticker.x + deltaX, 5, 95),
              y: clamp(gesture.startSticker.y + deltaY, 5, 95),
              size: nextSize,
              rotation: nextRotation,
            }
          : item
      )
    );
  }

  function endGesture(
    event: PointerEvent<HTMLButtonElement>,
    sticker: StorySticker
  ) {
    activePointersRef.current.delete(event.pointerId);

    const remainingPointers = getPointerList();

    if (!remainingPointers.length) {
      gestureRef.current = null;
      return;
    }

    const latestSticker =
      stickers.find((item) => item.id === sticker.id) || sticker;

    resetGesture(latestSticker);
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

    const scale = Math.max(
      canvas.width / photo.width,
      canvas.height / photo.height
    );
    const width = photo.width * scale;
    const height = photo.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    context.drawImage(photo, x, y, width, height);

    for (const sticker of stickers) {
      const stickerX = (sticker.x / 100) * canvas.width;
      const stickerY = (sticker.y / 100) * canvas.height;
      const stickerSize = (sticker.size / previewRect.width) * canvas.width;
      const rotation = (sticker.rotation * Math.PI) / 180;

      if (sticker.kind === "emoji") {
        context.save();
        context.translate(stickerX, stickerY);
        context.rotate(rotation);
        context.font = `${stickerSize}px Apple Color Emoji, Segoe UI Emoji, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.shadowColor = "rgba(0,0,0,0.5)";
        context.shadowBlur = 18;
        context.fillText(sticker.value, 0, 0);
        context.restore();
      }

      if (sticker.kind === "text") {
        context.save();
        context.translate(stickerX, stickerY);
        context.rotate(rotation);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `900 ${stickerSize}px Arial, sans-serif`;
        context.lineWidth = Math.max(8, stickerSize * 0.12);
        context.strokeStyle = "rgba(0,0,0,0.75)";
        context.fillStyle = "#ffffff";
        context.shadowColor = "rgba(0,0,0,0.45)";
        context.shadowBlur = 18;
        context.strokeText(sticker.value, 0, 0);
        context.fillText(sticker.value, 0, 0);
        context.restore();
      }

      if (sticker.kind === "image") {
        try {
          const image = await loadImage(sticker.value);

          const ratio = image.width / image.height;
          const drawWidth = stickerSize;
          const drawHeight = stickerSize / ratio;

          context.save();
          context.translate(stickerX, stickerY);
          context.rotate(rotation);
          context.shadowColor = "rgba(0,0,0,0.55)";
          context.shadowBlur = 18;
          context.drawImage(
            image,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
          );
          context.restore();
        } catch {
          // Ignore missing sticker image.
        }
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
          Add BGM, TSM, gym logos, emojis and captions. Move, pinch, rotate and
          share your story.
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
              draggable={false}
              className="h-full w-full select-none object-cover"
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
              onPointerDown={(event) => startGesture(event, sticker)}
              onPointerMove={(event) => moveGesture(event, sticker)}
              onPointerUp={(event) => endGesture(event, sticker)}
              onPointerCancel={(event) => endGesture(event, sticker)}
              className={`absolute z-10 cursor-grab touch-none select-none bg-transparent p-0 active:cursor-grabbing ${
                activeStickerId === sticker.id
                  ? "outline outline-2 outline-orange-500"
                  : ""
              }`}
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
              }}
            >
              {sticker.kind === "emoji" ? (
                <span
                  className="pointer-events-none block select-none drop-shadow-[0_0_12px_rgba(0,0,0,0.75)]"
                  style={{ fontSize: sticker.size }}
                >
                  {sticker.value}
                </span>
              ) : sticker.kind === "text" ? (
                <span
                  className="pointer-events-none block max-w-[320px] select-none whitespace-nowrap text-center font-black uppercase leading-none text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)] [-webkit-text-stroke:1px_rgba(0,0,0,0.65)]"
                  style={{ fontSize: sticker.size }}
                >
                  {sticker.value}
                </span>
              ) : (
                <img
                  src={sticker.value}
                  alt={sticker.label}
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                  className="pointer-events-none select-none drop-shadow-[0_0_12px_rgba(0,0,0,0.75)]"
                  style={{
                    width: sticker.size,
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.2em] text-white/35">
          <Move size={15} strokeWidth={3} />
          1 finger move · 2 finger pinch and rotate
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setOpenCategory("brands")}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm font-black text-white"
        >
          <Sticker size={18} strokeWidth={3} />
          Brand Logos
        </button>

        <button
          type="button"
          onClick={() => setOpenCategory("gyms")}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm font-black text-white"
        >
          <Dumbbell size={18} strokeWidth={3} />
          Gym Logos
        </button>

        <button
          type="button"
          onClick={() => setOpenCategory("emojis")}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm font-black text-white"
        >
          <Smile size={18} strokeWidth={3} />
          Emojis
        </button>

        <button
          type="button"
          onClick={() => setOpenCategory("text")}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm font-black text-white"
        >
          <Type size={18} strokeWidth={3} />
          Captions
        </button>
      </section>

      {activeSticker ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-white/40">
            Selected sticker
          </p>

          <p className="mt-2 text-sm font-bold text-white/60">
            {activeSticker.label}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={resetActiveStickerRotation}
              className="rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-black text-white"
            >
              Reset Rotate
            </button>

            <button
              type="button"
              onClick={removeActiveSticker}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-black text-white"
            >
              <Trash2 size={16} strokeWidth={3} />
              Remove
            </button>
          </div>
        </section>
      ) : null}

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

      {openCategory ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70 px-4 pb-28 pt-4 backdrop-blur-sm">
          <div className="max-h-[72vh] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                  Add Sticker
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {openCategory === "brands"
                    ? "Brand Logos"
                    : openCategory === "gyms"
                    ? "Gym Logos"
                    : openCategory === "emojis"
                    ? "Emojis"
                    : "Text Captions"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpenCategory(null)}
                className="rounded-full border border-white/10 bg-white/[0.04] p-3 text-white"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-5 pb-8">
              {openCategory === "brands" ? (
                <div className="grid gap-3">
                  {brandStickerOptions.map((brand) => (
                    <button
                      key={brand.label}
                      type="button"
                      onClick={() => addImageSticker(brand.label, brand.value)}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-left text-sm font-black text-white/70"
                    >
                      <img
                        src={brand.value}
                        alt=""
                        draggable={false}
                        className="h-12 w-12 object-contain"
                      />
                      {brand.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {openCategory === "gyms" ? (
                <div className="grid grid-cols-2 gap-3">
                  {gymStickerOptions.map((gym) => (
                    <button
                      key={gym.id}
                      type="button"
                      onClick={() => addGymSticker(gym)}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center text-xs font-black text-white/70"
                    >
                      <img
                        src={gym.logo || "/bgm-watermark.png"}
                        alt=""
                        draggable={false}
                        className="mx-auto h-16 w-16 object-contain"
                      />
                      <span className="mt-3 block">{gym.shortName}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {openCategory === "emojis" ? (
                <div className="grid grid-cols-4 gap-3">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addEmojiSticker(emoji)}
                      className="rounded-2xl border border-white/10 bg-black/25 px-4 py-5 text-3xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}

              {openCategory === "text" ? (
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-white/40">
                      Custom Caption
                    </p>

                    <div className="flex gap-3">
                      <input
                        value={customCaption}
                        onChange={(event) =>
                          setCustomCaption(event.target.value)
                        }
                        placeholder="Write your caption..."
                        className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />

                      <button
                        type="button"
                        onClick={() => addTextSticker(customCaption)}
                        className="flex shrink-0 items-center justify-center rounded-full bg-orange-500 px-4 text-black"
                      >
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-white/40">
                      Quick Captions
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {presetCaptions.map((caption) => (
                        <button
                          key={caption}
                          type="button"
                          onClick={() => addTextSticker(caption)}
                          className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-black text-white/70"
                        >
                          {caption}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
