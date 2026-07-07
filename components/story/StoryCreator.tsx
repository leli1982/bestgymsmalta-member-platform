"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  Camera,
  ChevronRight,
  Download,
  ImagePlus,
  Layers,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
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

type StorySticker = {
  id: string;
  label: string;
  src?: string;
  emoji?: string;
};

type StoryLayer = {
  id: string;
  stickerId: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type GestureStart = {
  layerId: string;
  size: number;
  rotation: number;
  distance: number;
  angle: number;
};

type HandleTransformStart = {
  layerId: string;
  mode: "resize" | "rotate";
  startSize: number;
  startRotation: number;
  startDistance: number;
  startAngle: number;
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

const stickers: StorySticker[] = [
  { id: "bgm", label: "BGM", src: "/bgm-logo.png" },
  { id: "tsm", label: "TSM", src: "/brand-logos/tsm.png" },

  { id: "emoji-fire", label: "Fire", emoji: "🔥" },
  { id: "emoji-strong", label: "Strong", emoji: "💪" },
  { id: "emoji-trophy", label: "Trophy", emoji: "🏆" },
  { id: "emoji-lightning", label: "Energy", emoji: "⚡" },
  { id: "emoji-check", label: "Done", emoji: "✅" },
  { id: "emoji-heart", label: "Love", emoji: "🖤" },
  { id: "emoji-camera", label: "Photo", emoji: "📸" },
  { id: "emoji-star", label: "Star", emoji: "⭐" },

  { id: "birkirkara", label: "Birkirkara", src: "/gym-logos/bgm-birkirkara.png" },
  { id: "birzebbuga", label: "Birzebbuga", src: "/gym-logos/bgm-birzebbuga.png" },
  { id: "build", label: "Build", src: "/gym-logos/bgm-build.png" },
  { id: "kirkop", label: "Kirkop", src: "/gym-logos/bgm-kirkop.png" },
  { id: "marsa", label: "Marsa", src: "/gym-logos/bgm-marsa.png" },
  { id: "marsascala", label: "Marsascala", src: "/gym-logos/bgm-marsascala.png" },
  { id: "neptunes", label: "Neptunes", src: "/gym-logos/bgm-neptunes.png" },
  { id: "pembroke", label: "Pembroke", src: "/gym-logos/bgm-pembroke.png" },
  { id: "sliema", label: "Sliema", src: "/gym-logos/bgm-sliema.png" },
  { id: "talqroqq", label: "Tal-Qroqq", src: "/gym-logos/bgm-talqroqq.png" },
  { id: "birgu", label: "Birgu", src: "/gym-logos/bgm-birgu.png" },
];

const defaultLayer: StoryLayer = {
  id: "layer-bgm-default",
  stickerId: "bgm",
  x: 16,
  y: 8,
  size: 82,
  rotation: 0,
};

function makeLayerId() {
  return `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  if (!text.trim()) return y;

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

function getDistance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getAngle(a: PointerPoint, b: PointerPoint) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export default function StoryCreator() {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customImage, setCustomImage] = useState("");
  const [storyLayers, setStoryLayers] = useState<StoryLayer[]>([defaultLayer]);
  const [selectedLayerId, setSelectedLayerId] = useState(defaultLayer.id);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [badge, setBadge] = useState("BestGymsMalta");
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const gestureStartRef = useRef<GestureStart | null>(null);
  const handleTransformRef = useRef<HandleTransformStart | null>(null);

  const selectedTemplate = useMemo(() => {
    return (
      templates.find((template) => template.id === selectedTemplateId) || null
    );
  }, [selectedTemplateId]);

  const selectedLayer = useMemo(() => {
    return storyLayers.find((layer) => layer.id === selectedLayerId) || null;
  }, [storyLayers, selectedLayerId]);

  const background = customImage || selectedTemplate?.background || "";

  function getSticker(stickerId: string) {
    return stickers.find((sticker) => sticker.id === stickerId) || stickers[0];
  }

  function updateLayer(layerId: string, updates: Partial<StoryLayer>) {
    setStoryLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, ...updates } : layer
      )
    );
  }

  function updateSelectedLayer(updates: Partial<StoryLayer>) {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, updates);
  }

  function addSticker(stickerId: string) {
    const offset = storyLayers.length * 7;

    const newLayer: StoryLayer = {
      id: makeLayerId(),
      stickerId,
      x: clamp(18 + offset, 10, 78),
      y: clamp(12 + offset, 8, 72),
      size: 82,
      rotation: 0,
    };

    setStoryLayers((current) => [...current, newLayer]);
    setSelectedLayerId(newLayer.id);
  }

  function removeSelectedLayer() {
    if (!selectedLayer) return;

    setStoryLayers((current) => {
      const remaining = current.filter((layer) => layer.id !== selectedLayer.id);
      setSelectedLayerId(remaining[remaining.length - 1]?.id || "");
      return remaining;
    });
  }

  function resetSelectedLayer() {
    if (!selectedLayer) return;

    updateLayer(selectedLayer.id, {
      x: 16,
      y: 8,
      size: 82,
      rotation: 0,
    });
  }

  function selectTemplate(template: StoryTemplate) {
    setSelectedTemplateId(template.id);
    setTitle(template.title);
    setSubtitle(template.subtitle);
    setBadge(template.badge);
  }

  function clearTemplate() {
    setSelectedTemplateId("");
    setTitle("");
    setSubtitle("");
    setBadge("BestGymsMalta");
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

  function pointerToPreviewPercent(point: PointerPoint) {
    const preview = previewRef.current;
    if (!preview) return { x: 50, y: 50 };

    const rect = preview.getBoundingClientRect();

    return {
      x: clamp(((point.x - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((point.y - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function beginPinchGesture(layer: StoryLayer) {
    const points = Array.from(activePointersRef.current.values());

    if (points.length < 2) {
      gestureStartRef.current = null;
      return;
    }

    const [a, b] = points;

    gestureStartRef.current = {
      layerId: layer.id,
      size: layer.size,
      rotation: layer.rotation,
      distance: getDistance(a, b),
      angle: getAngle(a, b),
    };
  }

  function moveLayerFromPointers(layer: StoryLayer) {
    const points = Array.from(activePointersRef.current.values());

    if (points.length === 1) {
      const position = pointerToPreviewPercent(points[0]);
      updateLayer(layer.id, position);
      return;
    }

    if (points.length >= 2) {
      const [a, b] = points;
      const center = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
      const position = pointerToPreviewPercent(center);

      if (!gestureStartRef.current || gestureStartRef.current.layerId !== layer.id) {
        beginPinchGesture(layer);
      }

      const gesture = gestureStartRef.current;

      if (!gesture) return;

      const currentDistance = getDistance(a, b);
      const currentAngle = getAngle(a, b);
      const scale =
        gesture.distance > 0 ? currentDistance / gesture.distance : 1;

      updateLayer(layer.id, {
        x: position.x,
        y: position.y,
        size: clamp(gesture.size * scale, 32, 180),
        rotation: gesture.rotation + (currentAngle - gesture.angle),
      });
    }
  }

  function handleLayerPointerDown(
    event: PointerEvent<HTMLDivElement>,
    layer: StoryLayer
  ) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedLayerId(layer.id);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore unsupported pointer capture.
    }

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activePointersRef.current.size >= 2) {
      beginPinchGesture(layer);
    } else {
      gestureStartRef.current = null;
      moveLayerFromPointers(layer);
    }
  }

  function handleLayerPointerMove(
    event: PointerEvent<HTMLDivElement>,
    layer: StoryLayer
  ) {
    if (!activePointersRef.current.has(event.pointerId)) return;

    event.preventDefault();
    event.stopPropagation();

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    moveLayerFromPointers(layer);
  }

  function handleLayerPointerUp(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);

    if (activePointersRef.current.size < 2) {
      gestureStartRef.current = null;
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore unsupported pointer capture.
    }
  }

  function getLayerCentrePoint(layer: StoryLayer): PointerPoint | null {
    const preview = previewRef.current;
    if (!preview) return null;

    const rect = preview.getBoundingClientRect();

    return {
      x: rect.left + (layer.x / 100) * rect.width,
      y: rect.top + (layer.y / 100) * rect.height,
    };
  }

  function startHandleTransform(
    event: PointerEvent<HTMLButtonElement>,
    layer: StoryLayer,
    mode: "resize" | "rotate"
  ) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedLayerId(layer.id);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore unsupported pointer capture.
    }

    const centre = getLayerCentrePoint(layer);
    if (!centre) return;

    const pointer = {
      x: event.clientX,
      y: event.clientY,
    };

    handleTransformRef.current = {
      layerId: layer.id,
      mode,
      startSize: layer.size,
      startRotation: layer.rotation,
      startDistance: Math.max(1, getDistance(centre, pointer)),
      startAngle: getAngle(centre, pointer),
    };
  }

  function moveHandleTransform(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const transform = handleTransformRef.current;
    if (!transform) return;

    const layer = storyLayers.find((item) => item.id === transform.layerId);
    if (!layer) return;

    const centre = getLayerCentrePoint(layer);
    if (!centre) return;

    const pointer = {
      x: event.clientX,
      y: event.clientY,
    };

    if (transform.mode === "resize") {
      const currentDistance = getDistance(centre, pointer);
      const scale = currentDistance / transform.startDistance;

      updateLayer(transform.layerId, {
        size: clamp(transform.startSize * scale, 28, 220),
      });

      return;
    }

    const currentAngle = getAngle(centre, pointer);

    updateLayer(transform.layerId, {
      rotation: transform.startRotation + (currentAngle - transform.startAngle),
    });
  }

  function endHandleTransform(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    handleTransformRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore unsupported pointer capture.
    }
  }

  async function renderStickerOnCanvas(
    ctx: CanvasRenderingContext2D,
    layer: StoryLayer
  ) {
    const sticker = getSticker(layer.stickerId);
    const size = layer.size * 3.2;
    const centerX = (layer.x / 100) * 1080;
    const centerY = (layer.y / 100) * 1920;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    if (sticker.src) {
      try {
        const image = await loadImage(sticker.src);
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
      } catch {
        // Ignore missing sticker image.
      }
    } else {
      ctx.font = `${size * 0.72}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sticker.emoji || "🔥", 0, 6);
    }

    ctx.restore();
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
      if (!background) throw new Error("No background.");
      const backgroundImage = await loadImage(background);
      drawCoverImage(ctx, backgroundImage, canvas.width, canvas.height);
    } catch {
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
      gradient.addColorStop(0, "#2b1d00");
      gradient.addColorStop(0.55, "#111111");
      gradient.addColorStop(1, "#000000");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }

    const darkOverlay = ctx.createLinearGradient(0, 0, 0, 1920);
    darkOverlay.addColorStop(0, "rgba(0,0,0,0.04)");
    darkOverlay.addColorStop(0.45, "rgba(0,0,0,0.10)");
    darkOverlay.addColorStop(1, "rgba(0,0,0,0.36)");
    ctx.fillStyle = darkOverlay;
    ctx.fillRect(0, 0, 1080, 1920);

    const goldOverlay = ctx.createLinearGradient(0, 0, 1080, 1920);
    goldOverlay.addColorStop(0, "rgba(252,180,21,0.08)");
    goldOverlay.addColorStop(0.45, "rgba(252,180,21,0.01)");
    goldOverlay.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = goldOverlay;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.strokeStyle = "rgba(252,180,21,0.78)";
    ctx.lineWidth = 8;
    roundedRect(ctx, 44, 44, 992, 1832, 54);
    ctx.stroke();

    if (badge.trim()) {
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      roundedRect(ctx, 474, 118, 520, 88, 44);
      ctx.fill();

      ctx.fillStyle = "#fcb415";
      ctx.font = "900 30px Arial";
      ctx.fillText(badge.toUpperCase(), 514, 174);
    }

    for (const layer of storyLayers) {
      await renderStickerOnCanvas(ctx, layer);
    }

    if (title.trim()) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 96px Arial";
      const lastTitleY = wrapText(ctx, title, 86, 1310, 890, 104);

      if (subtitle.trim()) {
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "700 38px Arial";
        wrapText(ctx, subtitle, 88, lastTitleY + 84, 860, 52);
      }
    }

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
              Take a photo, add multiple logos or stickers and share it.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#fcb415]/25 bg-black/50 p-4 shadow-2xl">
        <div
          ref={previewRef}
          className="relative mx-auto aspect-[9/16] w-full max-w-[360px] touch-none select-none overflow-hidden rounded-[2rem] border border-white/10 bg-cover bg-center shadow-2xl"
          style={{
            backgroundImage: background
              ? `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.34)), linear-gradient(135deg, rgba(252,180,21,.08), rgba(0,0,0,.12)), url('${background}')`
              : "linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.95))",
          }}
        >
          <div className="absolute inset-4 rounded-[1.6rem] border-2 border-[#fcb415]/70" />

          {badge.trim() ? (
            <div className="absolute right-7 top-7 rounded-full bg-black/40 px-4 py-2 backdrop-blur-md">
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#fcb415]">
                {badge}
              </p>
            </div>
          ) : null}

          {storyLayers.map((layer) => {
            const sticker = getSticker(layer.stickerId);
            const active = layer.id === selectedLayerId;

            return (
              <div
                key={layer.id}
                onPointerDown={(event) => handleLayerPointerDown(event, layer)}
                onPointerMove={(event) => handleLayerPointerMove(event, layer)}
                onPointerUp={handleLayerPointerUp}
                onPointerCancel={handleLayerPointerUp}
                className={`absolute touch-none select-none cursor-grab rounded-xl active:cursor-grabbing ${
                  active ? "ring-2 ring-[#fcb415]" : ""
                }`}
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                  transformOrigin: "center center",
                  touchAction: "none",
                }}
                title="Drag, pinch or rotate"
              >
                {sticker.src ? (
                  <img
                    src={sticker.src}
                    alt=""
                    draggable={false}
                    style={{
                      width: `${layer.size}px`,
                      height: `${layer.size}px`,
                    }}
                    className="select-none object-contain"
                  />
                ) : (
                  <span
                    style={{
                      width: `${layer.size}px`,
                      height: `${layer.size}px`,
                      fontSize: `${layer.size * 0.72}px`,
                    }}
                    className="flex select-none items-center justify-center leading-none"
                  >
                    {sticker.emoji}
                  </span>
                )}

                {active ? (
                  <>
                    <span className="pointer-events-none absolute -inset-2 rounded-xl border-2 border-[#fcb415]" />

                    <button
                      type="button"
                      aria-label="Rotate selected sticker"
                      onPointerDown={(event) =>
                        startHandleTransform(event, layer, "rotate")
                      }
                      onPointerMove={moveHandleTransform}
                      onPointerUp={endHandleTransform}
                      onPointerCancel={endHandleTransform}
                      className="absolute -right-4 -top-4 flex h-9 w-9 touch-none items-center justify-center rounded-full border border-black/40 bg-[#fcb415] text-sm font-black text-black shadow-xl"
                    >
                      ↻
                    </button>

                    <button
                      type="button"
                      aria-label="Resize selected sticker"
                      onPointerDown={(event) =>
                        startHandleTransform(event, layer, "resize")
                      }
                      onPointerMove={moveHandleTransform}
                      onPointerUp={endHandleTransform}
                      onPointerCancel={endHandleTransform}
                      className="absolute -bottom-4 -right-4 flex h-9 w-9 touch-none items-center justify-center rounded-full border border-black/40 bg-[#fcb415] text-sm font-black text-black shadow-xl"
                    >
                      ↔
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}

          {(title.trim() || subtitle.trim()) ? (
            <div className="absolute bottom-20 left-7 right-7">
              {title.trim() ? (
                <h2 className="text-4xl font-black leading-[0.95] text-white drop-shadow-2xl">
                  {title}
                </h2>
              ) : null}

              {subtitle.trim() ? (
                <p className="mt-4 text-sm font-bold leading-6 text-white/70">
                  {subtitle}
                </p>
              ) : null}
            </div>
          ) : null}

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
          Tap to select. Drag to move. Use the gold handles to resize or rotate.
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
          <Sparkles className="text-[#fcb415]" size={24} strokeWidth={3} />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Stickers & Logos
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Tap to add more
            </h2>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => addSticker(sticker.id)}
              className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-black text-white/60 transition hover:border-[#fcb415]/50 hover:text-white"
            >
              <span className="flex flex-col items-center gap-2">
                {sticker.src ? (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/10 p-1">
                    <img
                      src={sticker.src}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center text-3xl leading-none">
                    {sticker.emoji}
                  </span>
                )}

                <span className="max-w-full truncate">{sticker.label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
            Selected item
          </p>

          {selectedLayer ? (
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={resetSelectedLayer}
                  className="rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
                >
                  Reset Selected
                </button>

                <button
                  type="button"
                  onClick={removeSelectedLayer}
                  className="flex items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-black text-red-200"
                >
                  <Trash2 size={17} strokeWidth={3} />
                  Remove
                </button>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                  Size
                </span>

                <input
                  type="range"
                  min="32"
                  max="180"
                  value={selectedLayer.size}
                  onChange={(event) =>
                    updateSelectedLayer({ size: Number(event.target.value) })
                  }
                  className="accent-[#fcb415]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                  Rotate
                </span>

                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selectedLayer.rotation}
                  onChange={(event) =>
                    updateSelectedLayer({
                      rotation: Number(event.target.value),
                    })
                  }
                  className="accent-[#fcb415]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                  Move left / right
                </span>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedLayer.x}
                  onChange={(event) =>
                    updateSelectedLayer({ x: Number(event.target.value) })
                  }
                  className="accent-[#fcb415]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                  Move up / down
                </span>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedLayer.y}
                  onChange={(event) =>
                    updateSelectedLayer({ y: Number(event.target.value) })
                  }
                  className="accent-[#fcb415]"
                />
              </label>
            </div>
          ) : (
            <p className="mt-3 text-sm font-bold text-white/45">
              Add or tap a sticker to edit it.
            </p>
          )}
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
              Optional story style
            </h2>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={clearTemplate}
            className={`relative min-h-[150px] overflow-hidden rounded-[1.5rem] border p-4 text-left transition ${
              selectedTemplateId === ""
                ? "border-[#fcb415] bg-[#fcb415]/15 ring-2 ring-[#fcb415]/30"
                : "border-white/10 bg-black/25"
            }`}
          >
            <div className="relative flex min-h-[118px] flex-col justify-between">
              <span className="w-fit rounded-full bg-[#fcb415] px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] text-black">
                Clean
              </span>

              <div>
                <h3 className="text-lg font-black leading-tight text-white">
                  No template
                </h3>
                <p className="mt-1 text-xs font-bold text-white/55">
                  Photo + stickers only
                </p>
              </div>
            </div>
          </button>

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
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.38)), url('${template.background}')`,
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
              placeholder="Optional"
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
              placeholder="Optional"
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/25"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
