"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  Camera,
  Download,
  ImagePlus,
  Move,
  RotateCw,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

type Gym = {
  id: string;
  name: string;
  logo?: string;
  status?: string;
};

type StoryTemplate = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  tag: string;
};

type StoryLayer = {
  id: string;
  type: "image";
  src: string;
  label: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
};

const templates: StoryTemplate[] = [
  {
    id: "checked-in",
    label: "Checked In",
    title: "Checked in",
    subtitle: "Another session done at BestGymsMalta",
    tag: "BGM CHECK-IN",
  },
  {
    id: "passport-stamp",
    label: "Passport Stamp",
    title: "Passport stamp unlocked",
    subtitle: "One step closer to completing the BGM passport",
    tag: "STAMP UNLOCKED",
  },
  {
    id: "workout-complete",
    label: "Workout Done",
    title: "Workout complete",
    subtitle: "No excuses. Just progress.",
    tag: "SESSION COMPLETE",
  },
  {
    id: "ai-plan",
    label: "AI Plan",
    title: "New training plan started",
    subtitle: "Powered by the BGM AI Trainer",
    tag: "AI TRAINER",
  },
  {
    id: "ten-gyms",
    label: "10 Gyms",
    title: "10 gyms. 1 membership.",
    subtitle: "Train across the BestGymsMalta network",
    tag: "BESTGYMSMALTA",
  },
  {
    id: "progress",
    label: "Progress",
    title: "Progress update",
    subtitle: "Small steps. Big changes.",
    tag: "FITNESS JOURNEY",
  },
];

const defaultLayer: StoryLayer = {
  id: "bgm-logo",
  type: "image",
  src: "/bgm-logo.png",
  label: "BGM Logo",
  x: 68,
  y: 78,
  size: 20,
  rotation: 0,
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCoveredImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.width, height / image.height);
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const x = (width - scaledWidth) / 2;
  const y = (height - scaledHeight) / 2;

  ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
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

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, currentY);
  }

  return currentY;
}

export default function StoryCreator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [photo, setPhoto] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("checked-in");
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [layers, setLayers] = useState<StoryLayer[]>([defaultLayer]);
  const [selectedLayerId, setSelectedLayerId] = useState("bgm-logo");
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadGyms() {
      try {
        const response = await fetch("/api/gyms", { cache: "no-store" });
        const data = await response.json();
        setGyms((data.gyms || []).filter((gym: Gym) => gym.status === "active"));
      } catch {
        setGyms([]);
      }
    }

    loadGyms();
  }, []);

  const selectedTemplate = useMemo(() => {
    return (
      templates.find((template) => template.id === selectedTemplateId) ||
      templates[0]
    );
  }, [selectedTemplateId]);

  const storyTitle = customTitle.trim() || selectedTemplate.title;
  const storySubtitle = customSubtitle.trim() || selectedTemplate.subtitle;

  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);

  function handlePhotoUpload(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setPhoto(String(reader.result || ""));
      setStatus("Photo added. Choose a template or move the logo.");
    };

    reader.readAsDataURL(file);
  }

  function addLayer(src: string, label: string) {
    const id = `${label}-${Date.now()}`;

    setLayers((current) => [
      ...current,
      {
        id,
        type: "image",
        src,
        label,
        x: 65,
        y: 70,
        size: 18,
        rotation: 0,
      },
    ]);

    setSelectedLayerId(id);
    setStatus(`${label} added.`);
  }

  function updateSelectedLayer(updates: Partial<StoryLayer>) {
    if (!selectedLayerId) return;

    setLayers((current) =>
      current.map((layer) =>
        layer.id === selectedLayerId ? { ...layer, ...updates } : layer
      )
    );
  }

  function deleteSelectedLayer() {
    if (!selectedLayerId) return;

    setLayers((current) =>
      current.filter((layer) => layer.id !== selectedLayerId)
    );

    setSelectedLayerId("bgm-logo");
    setStatus("Sticker removed.");
  }

  function resetStory() {
    setPhoto("");
    setCustomTitle("");
    setCustomSubtitle("");
    setSelectedTemplateId("checked-in");
    setLayers([defaultLayer]);
    setSelectedLayerId("bgm-logo");
    setStatus("Story reset.");
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, layerId: string) {
    event.preventDefault();
    setSelectedLayerId(layerId);
    setDraggingLayerId(layerId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingLayerId || !previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setLayers((current) =>
      current.map((layer) =>
        layer.id === draggingLayerId
          ? {
              ...layer,
              x: Math.min(92, Math.max(8, x)),
              y: Math.min(92, Math.max(8, y)),
            }
          : layer
      )
    );
  }

  function handlePointerUp() {
    setDraggingLayerId(null);
  }

  async function createStoryFile() {
    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1920;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create story image.");

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#111111");
    gradient.addColorStop(0.45, "#1c1c1c");
    gradient.addColorStop(1, "#000000");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (photo) {
      try {
        const image = await loadImage(photo);
        drawCoveredImage(ctx, image, width, height);

        const overlay = ctx.createLinearGradient(0, 0, 0, height);
        overlay.addColorStop(0, "rgba(0,0,0,0.15)");
        overlay.addColorStop(0.55, "rgba(0,0,0,0.05)");
        overlay.addColorStop(1, "rgba(0,0,0,0.72)");
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
      } catch {
        // If the photo fails to load, keep the gradient.
      }
    }

    ctx.fillStyle = "rgba(252,180,21,0.96)";
    ctx.roundRect(70, 1120, width - 140, 52, 26);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "900 30px Arial";
    ctx.letterSpacing = "5px";
    ctx.fillText(selectedTemplate.tag, 110, 1156);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 96px Arial";
    wrapText(ctx, storyTitle, 70, 1290, width - 140, 106);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "700 42px Arial";
    wrapText(ctx, storySubtitle, 70, 1545, width - 140, 54);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.roundRect(70, 1695, width - 140, 120, 36);
    ctx.fill();

    ctx.fillStyle = "#fcb415";
    ctx.font = "900 34px Arial";
    ctx.fillText("BE THE BEST... BEAT THE REST", 105, 1768);

    for (const layer of layers) {
      try {
        const image = await loadImage(layer.src);
        const size = (layer.size / 100) * width;
        const x = (layer.x / 100) * width;
        const y = (layer.y / 100) * height;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
        ctx.restore();
      } catch {
        // Skip failed external image.
      }
    }

    return new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not create image."));
          return;
        }

        resolve(
          new File([blob], "bgm-story.png", {
            type: "image/png",
          })
        );
      }, "image/png");
    });
  }

  async function shareStory() {
    try {
      setStatus("Preparing story…");

      const file = await createStoryFile();

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "BestGymsMalta Story",
          text: "Created with the BestGymsMalta member app.",
          files: [file],
        });

        setStatus("Story shared.");
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bgm-story.png";
      link.click();
      URL.revokeObjectURL(url);

      setStatus("Story downloaded. Upload it to Instagram, Facebook or TikTok.");
    } catch {
      setStatus("Could not share story. Try downloading it instead.");
    }
  }

  async function downloadStory() {
    try {
      setStatus("Preparing download…");

      const file = await createStoryFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");

      link.href = url;
      link.download = "bgm-story.png";
      link.click();

      URL.revokeObjectURL(url);
      setStatus("Story downloaded.");
    } catch {
      setStatus("Could not download story.");
    }
  }

  const previewStyle: CSSProperties = photo
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,.12), rgba(0,0,0,.76)), url(${photo})`,
      }
    : {};

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#fcb415]/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#fcb415]/20 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
            Story Templates
          </p>

          <h1 className="mt-4 text-4xl font-black leading-tight text-white">
            Create a BGM story
          </h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Choose a template, add your photo, move the logo and share it to
            Instagram, Facebook or TikTok.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#fcb415]">
          Choose Template
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedTemplateId(template.id)}
              className={`rounded-2xl px-4 py-4 text-left text-sm font-black ${
                selectedTemplateId === template.id
                  ? "bg-[#fcb415] text-black"
                  : "border border-white/10 bg-black/25 text-white"
              }`}
            >
              {template.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div
          ref={previewRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black bg-cover bg-center shadow-2xl"
          style={previewStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80" />

          <div className="absolute bottom-20 left-5 right-5">
            <div className="inline-flex rounded-full bg-[#fcb415] px-4 py-2 text-[10px] font-black uppercase tracking-[.22em] text-black">
              {selectedTemplate.tag}
            </div>

            <h2 className="mt-4 text-4xl font-black leading-tight text-white drop-shadow">
              {storyTitle}
            </h2>

            <p className="mt-3 text-sm font-bold leading-6 text-white/70 drop-shadow">
              {storySubtitle}
            </p>

            <div className="mt-5 rounded-2xl bg-black/55 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
                Be the best... Beat the rest
              </p>
            </div>
          </div>

          {layers.map((layer) => (
            <div
              key={layer.id}
              onPointerDown={(event) => handlePointerDown(event, layer.id)}
              className={`absolute z-20 flex cursor-move touch-none items-center justify-center rounded-xl ${
                selectedLayerId === layer.id ? "ring-2 ring-[#fcb415]" : ""
              }`}
              style={{
                left: `${layer.x}%`,
                top: `${layer.y}%`,
                width: `${layer.size}%`,
                transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
              }}
            >
              <img
                src={layer.src}
                alt={layer.label}
                draggable={false}
                className="w-full select-none object-contain"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
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
          onChange={(event) => handlePhotoUpload(event.target.files?.[0])}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handlePhotoUpload(event.target.files?.[0])}
        />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#fcb415]">
          Custom Text
        </p>

        <div className="mt-4 grid gap-3">
          <input
            value={customTitle}
            onChange={(event) => setCustomTitle(event.target.value)}
            placeholder={selectedTemplate.title}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            value={customSubtitle}
            onChange={(event) => setCustomSubtitle(event.target.value)}
            placeholder={selectedTemplate.subtitle}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#fcb415]">
          Logos & Stickers
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => addLayer("/bgm-logo.png", "BGM Logo")}
            className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm font-black text-white"
          >
            BGM Logo
          </button>

          <button
            type="button"
            onClick={() => addLayer("/brand-logos/tsm.png", "TSM Logo")}
            className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm font-black text-white"
          >
            TSM Logo
          </button>
        </div>

        {gyms.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {gyms
              .filter((gym) => gym.logo)
              .slice(0, 10)
              .map((gym) => (
                <button
                  key={gym.id}
                  type="button"
                  onClick={() => addLayer(gym.logo || "", gym.name)}
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left text-xs font-black text-white"
                >
                  {gym.name}
                </button>
              ))}
          </div>
        ) : null}

        {selectedLayer ? (
          <div className="mt-5 rounded-2xl border border-[#fcb415]/30 bg-[#fcb415]/10 p-4">
            <div className="flex items-center gap-2">
              <Move className="text-[#fcb415]" size={18} strokeWidth={3} />
              <p className="text-sm font-black text-white">
                Editing: {selectedLayer.label}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  updateSelectedLayer({
                    size: Math.max(8, selectedLayer.size - 3),
                  })
                }
                className="rounded-full border border-white/10 bg-black/25 py-3 text-sm font-black text-white"
              >
                -
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSelectedLayer({
                    size: Math.min(48, selectedLayer.size + 3),
                  })
                }
                className="rounded-full border border-white/10 bg-black/25 py-3 text-sm font-black text-white"
              >
                +
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSelectedLayer({
                    rotation: selectedLayer.rotation + 15,
                  })
                }
                className="flex items-center justify-center rounded-full border border-white/10 bg-black/25 py-3 text-white"
              >
                <RotateCw size={16} strokeWidth={3} />
              </button>

              <button
                type="button"
                onClick={deleteSelectedLayer}
                className="flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 py-3 text-red-300"
              >
                <Trash2 size={16} strokeWidth={3} />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={shareStory}
          className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          <Share2 size={17} strokeWidth={3} />
          Share
        </button>

        <button
          type="button"
          onClick={downloadStory}
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
        >
          <Download size={17} strokeWidth={3} />
          Download
        </button>

        <button
          type="button"
          onClick={resetStory}
          className="col-span-2 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-5 py-4 text-sm font-black text-white"
        >
          <Sparkles size={17} strokeWidth={3} />
          Reset Story
        </button>
      </section>

      {status ? (
        <p className="text-center text-sm font-bold leading-6 text-white/50">
          {status}
        </p>
      ) : null}
    </div>
  );
}
