from pathlib import Path

path = Path("components/story/StoryCreator.tsx")
source = path.read_text()

handle_type = '''type HandleTransformStart = {
  layerId: string;
  mode: "resize" | "rotate";
  startSize: number;
  startRotation: number;
  startDistance: number;
  startAngle: number;
};
'''
replacement_type = handle_type + '\ntype StoryTool = "photo" | "text" | "stickers" | "templates";\n'
if 'type StoryTool = "photo" | "text" | "stickers" | "templates";' not in source:
    if handle_type not in source:
        raise SystemExit("Could not find HandleTransformStart type insertion point")
    source = source.replace(handle_type, replacement_type, 1)

state_line = '  const [busy, setBusy] = useState(false);\n'
state_replacement = state_line + '  const [activeTool, setActiveTool] = useState<StoryTool | null>(null);\n'
if 'const [activeTool, setActiveTool] = useState<StoryTool | null>(null);' not in source:
    if state_line not in source:
        raise SystemExit("Could not find busy state insertion point")
    source = source.replace(state_line, state_replacement, 1)

marker = '  return (\n    <div data-member-surface="story-light"'
if marker not in source:
    raise SystemExit("Could not find final StoryCreator return block")
prefix = source.split(marker, 1)[0]

new_return = r'''  return (
    <div
      data-member-surface="story-light"
      data-story-editor="canvas-first"
      className="relative pb-24 text-zinc-950"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleImageUpload(event.target.files?.[0]);
          setActiveTool(null);
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          handleImageUpload(event.target.files?.[0]);
          setActiveTool(null);
        }}
      />

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#ff5a0a]">
              Story Studio
            </p>
            <h2 className="mt-1 text-lg font-black text-zinc-950">
              Create. Tap. Share.
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadStory}
              disabled={busy}
              aria-label="Download story"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 disabled:opacity-60"
            >
              <Download size={17} strokeWidth={3} />
            </button>

            <button
              type="button"
              onClick={shareStory}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-200 disabled:opacity-60"
            >
              <Share2 size={16} strokeWidth={3} />
              Share
            </button>
          </div>
        </div>

        <div className="flex h-[48svh] min-h-[320px] max-h-[640px] justify-center">
          <div
            ref={previewRef}
            className="relative aspect-[9/16] h-full max-w-full touch-none select-none overflow-hidden rounded-[1.75rem] border border-white/10 bg-cover bg-center shadow-2xl"
            style={{
              backgroundImage: background
                ? `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.34)), linear-gradient(135deg, rgba(252,180,21,.08), rgba(0,0,0,.12)), url('${background}')`
                : "linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.95))",
            }}
          >
            <div className="absolute inset-4 rounded-[1.45rem] border-2 border-[#fcb415]/70" />

            {badge.trim() ? (
              <div className="absolute right-6 top-6 rounded-full bg-black/40 px-3 py-2 backdrop-blur-md">
                <p className="text-[8px] font-black uppercase tracking-[.2em] text-[#fcb415]">
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

            {title.trim() || subtitle.trim() ? (
              <div className="absolute bottom-16 left-6 right-6">
                {title.trim() ? (
                  <h2 className="text-3xl font-black leading-[0.95] text-white drop-shadow-2xl">
                    {title}
                  </h2>
                ) : null}

                {subtitle.trim() ? (
                  <p className="mt-3 text-xs font-bold leading-5 text-white/70">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[.2em] text-[#fcb415]">
                  Be the best... Beat the rest
                </p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[.16em] text-white/45">
                  BestGymsMalta
                </p>
              </div>

              <ChevronRight className="text-[#fcb415]" size={20} strokeWidth={3} />
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] font-bold text-zinc-500">
          Tap an item to select it. Drag, pinch or use the gold handles.
        </p>
      </section>

      {activeTool ? (
        <section
          data-story-tool-sheet={activeTool}
          className="fixed bottom-[calc(178px+env(safe-area-inset-bottom))] left-1/2 z-50 max-h-[42svh] w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 overflow-y-auto rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-2xl"
        >
          <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between bg-white px-1 pb-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a0a]">
                {activeTool === "photo"
                  ? "Photo"
                  : activeTool === "text"
                    ? "Text"
                    : activeTool === "stickers"
                      ? "Stickers & Logos"
                      : "Templates"}
              </p>
              <p className="mt-1 text-sm font-black text-zinc-950">
                {activeTool === "photo"
                  ? "Choose your background"
                  : activeTool === "text"
                    ? "Add your message"
                    : activeTool === "stickers"
                      ? "Tap one to add it"
                      : "Pick a quick style"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xl font-black text-zinc-700"
              aria-label="Close story tool"
            >
              ×
            </button>
          </div>

          {activeTool === "photo" ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#ff5a0a] px-4 py-4 text-sm font-black text-white"
              >
                <Camera size={18} strokeWidth={3} />
                Take Photo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-black text-zinc-950"
              >
                <Upload size={18} strokeWidth={3} />
                Upload
              </button>

              <button
                type="button"
                onClick={() => {
                  resetPhoto();
                  setActiveTool(null);
                }}
                className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-black text-zinc-950"
              >
                <RefreshCw size={18} strokeWidth={3} />
                Use Preset Background
              </button>
            </div>
          ) : null}

          {activeTool === "text" ? (
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">
                  Badge
                </span>
                <input
                  value={badge}
                  onChange={(event) => setBadge(event.target.value)}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-950 outline-none focus:border-[#ff5a0a] focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">
                  Main title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional"
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-[#ff5a0a] focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">
                  Subtitle
                </span>
                <textarea
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold leading-5 text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-[#ff5a0a] focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>
          ) : null}

          {activeTool === "stickers" ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-4 gap-2">
                {stickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => {
                      addSticker(sticker.id);
                      setActiveTool(null);
                    }}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-[10px] font-black text-zinc-600"
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      {sticker.src ? (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 p-1">
                          <img
                            src={sticker.src}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </span>
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center text-2xl leading-none">
                          {sticker.emoji}
                        </span>
                      )}
                      <span className="w-full truncate">{sticker.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              {selectedLayer ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">
                      Selected item
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={resetSelectedLayer}
                        className="rounded-full bg-[#ff5a0a] px-3 py-2 text-[10px] font-black text-white"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={removeSelectedLayer}
                        className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black text-red-700"
                      >
                        <Trash2 size={13} strokeWidth={3} />
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
                      <span className="text-[10px] font-bold text-zinc-500">Size</span>
                      <input
                        type="range"
                        min="32"
                        max="180"
                        value={selectedLayer.size}
                        onChange={(event) =>
                          updateSelectedLayer({ size: Number(event.target.value) })
                        }
                        className="accent-[#ff5a0a]"
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[10px] font-bold text-zinc-500">Rotate</span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={selectedLayer.rotation}
                        onChange={(event) =>
                          updateSelectedLayer({ rotation: Number(event.target.value) })
                        }
                        className="accent-[#ff5a0a]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-bold text-zinc-500">Left / right</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedLayer.x}
                          onChange={(event) =>
                            updateSelectedLayer({ x: Number(event.target.value) })
                          }
                          className="accent-[#ff5a0a]"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-bold text-zinc-500">Up / down</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedLayer.y}
                          onChange={(event) =>
                            updateSelectedLayer({ y: Number(event.target.value) })
                          }
                          className="accent-[#ff5a0a]"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTool === "templates" ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => {
                  clearTemplate();
                  setActiveTool(null);
                }}
                className={`relative min-h-[135px] min-w-[132px] overflow-hidden rounded-[1.5rem] border p-3 text-left ${
                  selectedTemplateId === ""
                    ? "border-[#ff5a0a] bg-orange-50 ring-2 ring-orange-100"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <div className="flex min-h-[105px] flex-col justify-between">
                  <span className="w-fit rounded-full bg-[#ff5a0a] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.14em] text-white">
                    Clean
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-zinc-950">No template</h3>
                    <p className="mt-1 text-[10px] font-bold text-zinc-500">Photo + stickers</p>
                  </div>
                </div>
              </button>

              {templates.map((template) => {
                const active = template.id === selectedTemplateId;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      selectTemplate(template);
                      setActiveTool(null);
                    }}
                    className={`relative min-h-[135px] min-w-[132px] overflow-hidden rounded-[1.5rem] border bg-cover bg-center p-3 text-left ${
                      active
                        ? "border-[#ff5a0a] ring-2 ring-orange-200"
                        : "border-white/10"
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.48)), url('${template.background}')`,
                    }}
                  >
                    <div className="flex min-h-[105px] flex-col justify-between">
                      <span className="w-fit rounded-full bg-[#fcb415] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.14em] text-black">
                        {template.badge}
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-white">{template.name}</h3>
                        <p className="mt-1 text-[10px] font-bold text-white/60">{template.mood}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <nav
        data-story-tool-dock
        aria-label="Story tools"
        className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-40 grid w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 grid-cols-4 gap-1 rounded-[1.75rem] border border-zinc-200 bg-white/95 p-2 shadow-2xl backdrop-blur-xl"
      >
        <button
          data-story-tool="photo"
          type="button"
          onClick={() => setActiveTool(activeTool === "photo" ? null : "photo")}
          className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[10px] font-black ${
            activeTool === "photo" ? "bg-[#ff5a0a] text-white" : "text-zinc-600"
          }`}
        >
          <ImagePlus size={19} strokeWidth={3} />
          Photo
        </button>

        <button
          data-story-tool="text"
          type="button"
          onClick={() => setActiveTool(activeTool === "text" ? null : "text")}
          className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[10px] font-black ${
            activeTool === "text" ? "bg-[#ff5a0a] text-white" : "text-zinc-600"
          }`}
        >
          <Type size={19} strokeWidth={3} />
          Text
        </button>

        <button
          data-story-tool="stickers"
          type="button"
          onClick={() => setActiveTool(activeTool === "stickers" ? null : "stickers")}
          className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[10px] font-black ${
            activeTool === "stickers" ? "bg-[#ff5a0a] text-white" : "text-zinc-600"
          }`}
        >
          <Sparkles size={19} strokeWidth={3} />
          Stickers
        </button>

        <button
          data-story-tool="templates"
          type="button"
          onClick={() => setActiveTool(activeTool === "templates" ? null : "templates")}
          className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[10px] font-black ${
            activeTool === "templates" ? "bg-[#ff5a0a] text-white" : "text-zinc-600"
          }`}
        >
          <Layers size={19} strokeWidth={3} />
          Templates
        </button>
      </nav>
    </div>
  );
}
'''

path.write_text(prefix + new_return)
