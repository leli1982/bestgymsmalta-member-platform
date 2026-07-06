"use client";

import { useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronRight,
  Download,
  ImagePlus,
  Layers,
  RefreshCw,
  Share2,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";

type StoryTemplate = {
  id: string;
  name: string;
  badge: string;
  title: string;
  subtitle: string;
  background: string;
  mood: string;
};

type BrandSticker = {
  id: string;
  label: string;
  src: string;
};

const templates: StoryTemplate[] = [
  {
    id: "beast-mode",
    name: "Beast Mode",
    badge: "BGM Energy",
    title: "Best mode: ON",
    subtitle: "Another session done. Be the best... Beat the rest.",
    background: "/visuals/story.jpg",
    mood: "High energy",
  },
  {
    id: "workout-done",
    name: "Workout Done",
    badge: "Session Complete",
    title: "Workout done",
    subtitle: "Showed up. Put in the work. Left stronger.",
    background: "/visuals/trainer.jpg",
    mood: "Clean fitness",
  },
  {
    id: "progress",
    name: "Progress",
    badge: "Progress Mode",
    title: "Small steps. Big changes.",
    subtitle: "Every rep, every set, every session counts.",
    background: "/visuals/progress.jpg",
    mood: "Transformation",
  },
  {
    id: "network",
    name: "10 Gyms",
    badge: "BestGymsMalta",
    title: "1 membership. 10 gyms.",
    subtitle: "Train where it suits you across the BGM network.",
    background: "/visuals/gyms.jpg",
    mood: "BGM network",
  },
  {
    id: "no-excuses",
    name: "No Excuses",
    badge: "Mindset",
    title: "No excuses today",
    subtitle: "Discipline beats motivation.",
    background: "/visuals/home-hero.jpg",
    mood: "Motivational",
  },
  {
    id: "fresh-start",
    name: "Fresh Start",
    badge: "New Session",
    title: "New day. New energy.",
    subtitle: "Your future self is watching.",
    background: "/visuals/announcement-default.jpg",
    mood: "Lifestyle",
  },
];

const brandStickers: BrandSticker[] = [
  { id: "bgm", label: "BGM", src: "/bgm-logo.png" },
  { id: "tsm", label: "TSM", src: "/brand-logos/tsm.png" },
  { id: "birkirkara", label: "Birkirkara", src: "/gym-logos/bgm-birkirkara.png" },
  { id: "birzebbuga", label: "Birzebbuga", src: "/gym-logos/bgm-birzebbuga.png" },
  { id: "build", label: "Build", src: "/gym-logos/bgm-build.png" },
  { id: "kirkop", label: "Kirkop", src: "/gym-logos/bgm-kirkop.png" },
  { id: "marsa", label: "Marsa", src: "/gym-logos/bgm-marsa.png" },
  { id: "neptunes", label: "Neptunes", src: "/gym-logos/bgm-neptunes.png" },
  { id: "pembroke", label: "Pembroke", src: "/gym-logos/bgm-pembroke.png" },
  { id: "sliema", label: "Sliema", src: "/gym-logos/bgm-sliema.png" },
  { id: "talqroqq", label: "Tal-Qroqq", src: "/gym-logos/bgm-talqroqq.png" },
];

const stickerPositions = [
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let x = 0;
  let y = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
    x = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
    y = (height - drawHeight) / 2;
  }

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = `${line}${words[n]} `;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = `${words[n]} `;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

function getPreviewLogoPosition(position: string) {
  if (position === "top-right") return "right-7 top-20";
  if (position === "bottom-left") return "bottom-24 left-7";
  if (position === "bottom-right") return "bottom-24 right-7";
  return "left-7 top-7";
}

export default function StoryCreator() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [customImage, setCustomImage] = useState("");
  const [selectedStickerId, setSelectedStickerId] = useState("bgm");
  const [stickerPosition, setStickerPosition] = useState("top-left");
  const [logoSize, setLogoSize] = useState(92);
  const [title, setTitle] = useState(templates[0].title);
  const [subtitle, setSubtitle] = useState(templates[0].subtitle);
  const [badge, setBadge] = useState(templates[0].badge);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate = useMemo(() => {
    return templates.find((template) => template.id === selectedTemplateId) || templates[0];
  }, [selectedTemplateId]);

  const selectedSticker = useMemo(() => {
    return brandStickers.find((sticker) => sticker.id === selectedStickerId) || brandStickers[0];
  }, [selectedStickerId]);

  const background = customImage || selectedTemplate.background;

  function selectTemplate(template: StoryTemplate) {
    setSelectedTemplateId(template.id);
    setTitle(template.title);
    setSubtitle(template.subtitle);
    setBadge(template.badge);
  }

  function handleImageUpload(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setCustomImage(String(reader.result || ""));
    };

    reader.readAsDataURL(file);
  }

  function resetPhoto() {
    setCustomImage("");
  }

  async function renderStoryBlob() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not create canvas.");
    }

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      const backgroundImage = await loadImage(background);
      drawCoverImage(ctx, backgroundImage, canvas.width, canvas.height);
    } catch {
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
      gradient.addColorStop(0, "#2b1d00");
      gradient.addColorStop(0.45, "#111111");
      gradient.addColorStop(1, "#000000");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }

    const darkOverlay = ctx.createLinearGradient(0, 0, 0, 1920);
    darkOverlay.addColorStop(0, "rgba(0,0,0,0.15)");
    darkOverlay.addColorStop(0.42, "rgba(0,0,0,0.32)");
    darkOverlay.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = darkOverlay;
    ctx.fillRect(0, 0, 1080, 1920);

    const goldOverlay = ctx.createLinearGradient(0, 0, 1080, 1920);
    goldOverlay.addColorStop(0, "rgba(252,180,21,0.24)");
    goldOverlay.addColorStop(0.45, "rgba(252,180,21,0.03)");
    goldOverlay.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = goldOverlay;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.strokeStyle = "rgba(252,180,21,0.88)";
    ctx.lineWidth = 8;
    roundedRect(ctx, 44, 44, 992, 1832, 54);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.52)";
    roundedRect(ctx, 474, 118, 520, 88, 44);
    ctx.fill();

    ctx.fillStyle = "#fcb415";
    ctx.font = "900 30px Arial";
    ctx.fillText((badge || "BESTGYMSMALTA").toUpperCase(), 514, 174);

    if (selectedSticker) {
      try {
        const sticker = await loadImage(selectedSticker.src);
        const size = logoSize * 3.2;
        const padding = 86;

        let x = padding;
        let y = 106;

        if (stickerPosition === "top-right") {
          x = 1080 - padding - size;
          y = 230;
        }

        if (stickerPosition === "bottom-left") {
          x = padding;
          y = 1580;
        }

        if (stickerPosition === "bottom-right") {
          x = 1080 - padding - size;
          y = 1580;
        }

        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundedRect(ctx, x - 18, y - 18, size + 36, size + 36, 42);
        ctx.fill();

        ctx.drawImage(sticker, x, y, size, size);
      } catch {
        // Ignore missing stickers.
      }
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 96px Arial";
    const lastTitleY = wrapText(
      ctx,
      title || "Best mode: ON",
      86,
      1310,
      890,
      104
    );

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 38px Arial";
    wrapText(
      ctx,
      subtitle || "Be the best... Beat the rest.",
      88,
      lastTitleY + 84,
      860,
      52
    );

    ctx.fillStyle = "#fcb415";
    ctx.font = "900 28px Arial";
    ctx.fillText("BE THE BEST... BEAT THE REST", 88, 1786);

    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "700 25px Arial";
    ctx.fillText("BESTGYMSMALTA", 88, 1832);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not export story."));
            return;
          }

          resolve(blob);
        },
        "image/png",
        1
      );
    });
  }

  async function downloadStory() {
    try {
      setBusy(true);

      const blob = await renderStoryBlob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "bestgymsmalta-story.png";
      link.click();

      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function shareStory() {
    try {
      setBusy(true);

      const blob = await renderStoryBlob();
      const file = new File([blob], "bestgymsmalta-story.png", {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "BestGymsMalta Story",
          text: "Created with the BestGymsMalta app",
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        className="relative min-h-[300px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.82)), url('/visuals/story.jpg')",
        }}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative flex min-h-[250px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Story Studio
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/35 text-[#fcb415] backdrop-blur-md">
              <Camera size={24} strokeWidth={3} />
            </div>
          </div>

          <div>
            <h1 className="text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Create your BGM story
            </h1>

            <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
              Take a photo, brand it and share it.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#fcb415]/25 bg-black/50 p-4 shadow-2xl">
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[2rem] border border-white/10 bg-cover bg-center shadow-2xl"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.86)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.50)), url('${background}')`,
          }}
        >
          <div className="absolute inset-4 rounded-[1.6rem] border-2 border-[#fcb415]/80" />

          <div className="absolute right-7 top-7 rounded-full bg-black/50 px-4 py-2 backdrop-blur-md">
            <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#fcb415]">
              {badge}
            </p>
          </div>

          {selectedSticker ? (
            <div
              className={`absolute rounded-2xl bg-black/45 p-2 backdrop-blur-md ${getPreviewLogoPosition(
                stickerPosition
              )}`}
            >
              <img
                src={selectedSticker.src}
                alt=""
                style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
                className="object-contain"
              />
            </div>
          ) : null}

          <div className="absolute bottom-20 left-7 right-7">
            <h2 className="text-4xl font-black leading-[0.95] text-white drop-shadow-2xl">
              {title}
            </h2>

            <p className="mt-4 text-sm font-bold leading-6 text-white/70">
              {subtitle}
            </p>
          </div>

          <div className="absolute bottom-7 left-7 right-7 flex items-end justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#fcb415]">
                Be the best... Beat the rest
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/45">
                BestGymsMalta
              </p>
            </div>

            <ChevronRight className="text-[#fcb415]" size={22} strokeWidth={3} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={shareStory}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-60"
          >
            <Share2 size={17} strokeWidth={3} />
            Share
          </button>

          <button
            type="button"
            onClick={downloadStory}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            <Download size={17} strokeWidth={3} />
            Download
          </button>
        </div>

        <p className="mt-4 text-center text-xs font-bold leading-5 text-white/35">
          Exports as a clean 1080x1920 Instagram story image.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <ImagePlus className="text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Photo
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Take or upload a photo
            </h2>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleImageUpload(event.target.files?.[0])}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handleImageUpload(event.target.files?.[0])}
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

          <button
            type="button"
            onClick={resetPhoto}
            className="col-span-2 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
          >
            <RefreshCw size={17} strokeWidth={3} />
            Use Preset Background
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Layers className="text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Templates
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Pick a story style
            </h2>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {templates.map((template) => {
            const active = template.id === selectedTemplateId;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={`relative min-h-[150px] overflow-hidden rounded-[1.5rem] border bg-cover bg-center p-4 text-left transition ${
                  active
                    ? "border-[#fcb415] ring-2 ring-[#fcb415]/30"
                    : "border-white/10"
                }`}
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.82)), url('${template.background}')`,
                }}
              >
                <div className="relative flex min-h-[118px] flex-col justify-between">
                  <span className="w-fit rounded-full bg-[#fcb415] px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] text-black">
                    {template.badge}
                  </span>

                  <div>
                    <h3 className="text-lg font-black leading-tight text-white">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-white/55">
                      {template.mood}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Type className="text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Text
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Edit your message
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Badge
            </span>
            <input
              value={badge}
              onChange={(event) => setBadge(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Main title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Subtitle
            </span>
            <textarea
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              rows={3}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/25"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Logo Sticker
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Brand your story
            </h2>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {brandStickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => setSelectedStickerId(sticker.id)}
              className={`rounded-2xl border p-3 text-xs font-black transition ${
                sticker.id === selectedStickerId
                  ? "border-[#fcb415] bg-[#fcb415] text-black"
                  : "border-white/10 bg-black/25 text-white/60"
              }`}
            >
              {sticker.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Sticker position
            </span>

            <select
              value={stickerPosition}
              onChange={(event) => setStickerPosition(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none"
            >
              {stickerPositions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
              Sticker size
            </span>

            <input
              type="range"
              min="56"
              max="130"
              value={logoSize}
              onChange={(event) => setLogoSize(Number(event.target.value))}
              className="accent-[#fcb415]"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
