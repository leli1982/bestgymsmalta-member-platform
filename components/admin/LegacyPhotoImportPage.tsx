"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Images, ShieldCheck, UploadCloud } from "lucide-react";

type Ready = {
  memberNumber: string; legacyPk: string; memberName: string;
  imageFile: string; expiry: string;
};
type Result = { memberNumber: string; photo: string; outcome: string; detail: string };
type Progress = { processed: number; saved: number; skipped: number; failed: number; total: number };

function parseCsv(input: string): string[][] {
  const result: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else { quoted = !quoted; }
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) result.push(row);
      row = [];
    } else { cell += c; }
  }
  if (quoted) throw new Error("Report contains an unclosed quoted CSV value.");
  if (cell !== "" || row.length) { row.push(cell); result.push(row); }
  return result;
}
function parseReady(text: string) {
  const raw = parseCsv(text);
  const headers = raw.shift()?.map((h) => h.trim().toLowerCase()) || [];
  for (const name of ["member_id", "pkcustomer", "member_name", "image_file", "decision", "existing_photo", "status"]) {
    if (!headers.includes(name)) throw new Error("Wrong report: missing " + name);
  }
  const at = (row: string[], name: string) => (row[headers.indexOf(name)] || "").trim();
  const ready: Ready[] = [];
  let bad = 0; let other = 0;
  for (const row of raw) {
    if (at(row, "decision") !== "READY_FOR_MANUAL_REVIEW") { other += 1; continue; }
    const memberNumber = at(row, "member_id").toUpperCase();
    const legacyPk = at(row, "pkcustomer");
    const imageFile = at(row, "image_file").replace(/\\/g, "/");
    if (!/^BGM[1-9][0-9]{3,}$/.test(memberNumber)
      || !/^[a-z0-9-]{1,50}$/i.test(legacyPk)
      || !/^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(imageFile)
      || imageFile.slice(0, imageFile.lastIndexOf(".")).toLowerCase() !== legacyPk.toLowerCase()
      || at(row, "existing_photo").toUpperCase() !== "NO"
      || at(row, "status").toLowerCase() !== "valid") { bad += 1; continue; }
    ready.push({ memberNumber, legacyPk, imageFile,
      memberName: at(row, "member_name"), expiry: at(row, "expiry") });
  }
  // Eliminate all collisions instead of arbitrarily keeping the first row.
  const duplicates = new Set<string>(); const keys = new Map<string, number>();
  for (const r of ready) for (const k of [
    "member:" + r.memberNumber.toLowerCase(),
    "pk:" + r.legacyPk.toLowerCase(), "image:" + r.imageFile.toLowerCase(),
  ]) keys.set(k, (keys.get(k) || 0) + 1);
  for (const r of ready) if ([
    "member:" + r.memberNumber.toLowerCase(),
    "pk:" + r.legacyPk.toLowerCase(), "image:" + r.imageFile.toLowerCase(),
  ].some((key) => (keys.get(key) || 0) > 1)) duplicates.add(r.memberNumber);
  return {
    ready: ready.filter((r) => !duplicates.has(r.memberNumber)),
    excluded: other + bad + duplicates.size,
    suspect: bad + duplicates.size,
    reportTotal: raw.length,
  };
}
function escapeCsv(value: unknown) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportResults(rows: Result[]) {
  const lines = [["member_number", "image_file", "result", "detail"],
    ...rows.map((r) => [r.memberNumber, r.photo, r.outcome, r.detail])];
  const blob = new Blob([lines.map((row) => row.map(escapeCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "bgm-photo-upload-results.csv"; a.click(); URL.revokeObjectURL(url);
}
async function toWebp(file: File, pk: string): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("Image has invalid dimensions.");
    const maxSide = 1000;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not convert image.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("WebP conversion failed.")), "image/webp", 0.83));
    return new File([blob], pk + ".webp", { type: "image/webp" });
  } finally { bitmap.close(); }
}
async function sendPhoto(row: Ready, file: File): Promise<{ outcome: string; detail: string }> {
  const webp = await toWebp(file, row.legacyPk);
  const fields = new FormData();
  fields.append("memberNumber", row.memberNumber);
  fields.append("pkCustomer", row.legacyPk);
  fields.append("sourceImage", file.name);
  fields.append("file", webp);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/system/admin/photo-import", {
        method: "POST", credentials: "same-origin", body: fields,
      });
      const body = await response.json().catch(() => ({})) as {
        ok?: boolean; assigned?: boolean; skipped?: boolean; reason?: string; error?: string;
      };
      if (response.ok && body.assigned) return { outcome: "SAVED", detail: "Official photo attached" };
      if (response.ok && body.skipped) return { outcome: "SKIPPED", detail: body.reason || "Not eligible" };
      if ([401, 403].includes(response.status)) throw new Error("Super Admin login expired or access denied.");
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
        return { outcome: "FAILED", detail: body.error || "HTTP " + response.status };
      }
    } catch (error) {
      if (attempt === 2 || (error instanceof Error && /access denied|login expired/i.test(error.message))) {
        return { outcome: "FAILED", detail: error instanceof Error ? error.message : "Network error" };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1300));
  }
  return { outcome: "FAILED", detail: "Unknown retry failure" };
}
export default function LegacyPhotoImportPage() {
  const folderInput = useRef<HTMLInputElement>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rawReport, setRawReport] = useState<ReturnType<typeof parseReady> | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>({ processed: 0, saved: 0, skipped: 0, failed: 0, total: 0 });
  const [results, setResults] = useState<Result[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
    fetch("/api/system/auth", { cache: "no-store" }).then((r) => r.json())
      .then((v) => setAllowed(Boolean(v.authenticated && v.user?.isSuperAdmin)))
      .catch(() => setAllowed(false));
  }, []);

  const indexedFiles = useMemo(() => {
    const map = new Map<string, File>(); const collisions = new Set<string>();
    for (const f of folderFiles) {
      const relative = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
      const parts = relative.split("/");
      const path = (parts.length > 1 ? parts.slice(1).join("/") : relative).toLowerCase();
      if (map.has(path)) collisions.add(path);
      else map.set(path, f);
    }
    for (const key of collisions) map.delete(key);
    return map;
  }, [folderFiles]);
  const eligible = useMemo(() => (rawReport?.ready || [])
    .filter((r) => indexedFiles.has(r.imageFile.toLowerCase())), [rawReport, indexedFiles]);
  const sample = eligible.slice(0, 10);
  const [sampleImages, setSampleImages] = useState<Array<{ row: Ready; url: string }>>([]);
  useEffect(() => {
    const images = sample.map((row) => ({ row,
      url: URL.createObjectURL(indexedFiles.get(row.imageFile.toLowerCase())!),
    }));
    setSampleImages(images);
    return () => images.forEach((i) => URL.revokeObjectURL(i.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexedFiles, rawReport]);

  async function readReport(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseReady(await file.text());
      setRawReport(parsed); setResults([]); setCompletedIds(new Set()); setError("");
    } catch (e) { setRawReport(null); setError(e instanceof Error ? e.message : "Unreadable report."); }
  }
  async function uploadBatch(firstTen: boolean) {
    if (busy || !eligible.length) return;
    const remaining = eligible.filter((r) => !completedIds.has(r.memberNumber));
    const selected = firstTen ? remaining.slice(0, 10) : remaining;
    if (!selected.length) { setError("All selected files have been processed in this browser session."); return; }
    if (!firstTen && !window.confirm(`Upload ${selected.length} remaining photos to the LIVE BGM database? Existing photos, inactive members and ambiguous numbers will be skipped automatically.`)) return;
    setBusy(true); setError("");
    const counts: Progress = { processed: 0, saved: 0, skipped: 0, failed: 0, total: selected.length };
    setProgress({ ...counts }); let next = 0; const batchResults: Result[] = [];
    const doneIds = new Set(completedIds);
    try {
      await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
        for (;;) {
          const index = next; next += 1;
          if (index >= selected.length) return;
          const r = selected[index]; const file = indexedFiles.get(r.imageFile.toLowerCase());
          let outcome: { outcome: string; detail: string };
          if (!file) outcome = { outcome: "FAILED", detail: "Image file not found." };
          else outcome = await sendPhoto(r, file);
          batchResults.push({ memberNumber: r.memberNumber, photo: r.imageFile, ...outcome });
          counts.processed += 1;
          if (outcome.outcome === "SAVED") counts.saved += 1;
          else if (outcome.outcome === "SKIPPED") counts.skipped += 1;
          else counts.failed += 1;
          if (outcome.outcome !== "FAILED") doneIds.add(r.memberNumber);
          setProgress({ ...counts });
        }
      }));
    } finally {
      setResults((prev) => [...prev, ...batchResults]);
      setCompletedIds(doneIds); setBusy(false);
    }
  }
  if (allowed === null) return <main className="p-8 text-zinc-800">Checking Super Admin access…</main>;
  if (!allowed) return <main className="p-8 text-zinc-800">Super Admin access required. <a href="/staff" className="underline">Staff login</a></main>;
  return <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-bold text-yellow-800"><ArrowLeft size={16}/> Super Admin</a>
        <h1 className="mt-4 flex items-center gap-3 text-3xl font-black"><Images/> Legacy member photo upload</h1>
        <p className="mt-2 text-sm text-zinc-600">Select the saved photo matching report and the extracted images folder on this computer. Preview ten examples, run a live ten-photo test, then upload the rest. Every photo is checked against the live BGM database.</p>
      </header>
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck size={18}/> Existing official photos are never overwritten</div>
        <p className="mt-1 text-sm text-zinc-600">Inactive members, shared legacy numbers, changed identities and records with existing photos are skipped. Original JPGs remain on your PC. Uploaded images are converted to private WebP. The process is resumable: if interrupted, select the same report and folder again; the server skips already saved photos.</p>
      </section>
      <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="block text-sm font-bold">1. Select photo_matching_report.csv
          <input type="file" accept=".csv,text/csv" disabled={busy}
            className="mt-3 block w-full rounded-xl border border-zinc-200 p-3"
            onChange={(event) => void readReport(event.target.files?.[0])}/>
        </label>
        <label className="block text-sm font-bold">2. Select the extracted images folder
          <input ref={folderInput} type="file" multiple disabled={busy}
            className="mt-3 block w-full rounded-xl border border-zinc-200 p-3"
            onChange={(event) => setFolderFiles(Array.from(event.target.files || []))}/>
        </label>
        <p className="text-sm text-zinc-600 md:col-span-2">Report candidates: <strong>{rawReport?.ready.length ?? 0}</strong> · Source files found: <strong>{folderFiles.length}</strong> · Verified filename matches: <strong>{eligible.length}</strong> · Missing files: <strong>{(rawReport?.ready.length || 0) - eligible.length}</strong> · Rejected/held report rows: <strong>{rawReport?.excluded || 0}</strong></p>
        {rawReport && rawReport.suspect > 0 && <p className="text-sm font-bold text-amber-800 md:col-span-2">{rawReport.suspect} malformed or duplicated candidates were excluded.</p>}
      </section>
      {sampleImages.length > 0 && <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">Check the first 10 photo examples</h2>
        <p className="mb-4 text-sm text-zinc-600">Match the photo to the member name and permanent BGM number before running the first upload.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {sampleImages.map((image) => <div key={image.row.memberNumber} className="rounded-xl border border-zinc-200 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.row.imageFile} className="aspect-square w-full rounded-lg object-cover"/>
            <p className="mt-2 break-words text-xs font-bold">{image.row.memberName}</p>
            <p className="text-xs text-zinc-500">{image.row.memberNumber}</p>
            <p className="text-xs text-zinc-500">{image.row.imageFile}</p>
          </div>)}
        </div>
      </section>}
      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button disabled={busy || !eligible.length}
            onClick={() => void uploadBatch(true)}
            className="rounded-xl bg-[#ffb400] px-5 py-3 font-black text-black disabled:opacity-40">3. Upload test batch (10)</button>
          <button disabled={busy || !eligible.length}
            onClick={() => void uploadBatch(false)}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 font-black text-white disabled:opacity-40"><UploadCloud size={18}/> 4. Upload remaining verified matches</button>
          <button disabled={!results.length || busy} onClick={() => exportResults(results)}
            className="rounded-xl border border-zinc-200 px-5 py-3 font-bold disabled:opacity-40">Download results CSV</button>
        </div>
        {busy && <p className="font-bold text-amber-800">Uploading photos. Keep this tab open until the batch finishes.</p>}
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <p>Processed <strong>{progress.processed}/{progress.total}</strong></p>
          <p className="text-emerald-700">Saved <strong>{progress.saved}</strong></p>
          <p>Safely skipped <strong>{progress.skipped}</strong></p>
          <p className="text-rose-700">Failed <strong>{progress.failed}</strong></p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-[#ffb400]" style={{width:progress.total ? `${100 * progress.processed / progress.total}%` : "0%"}}/></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
        {results.length > 0 && <div className="text-sm text-zinc-600">Last result: <strong>{results[results.length-1].memberNumber}</strong> · {results[results.length-1].outcome} · {results[results.length-1].detail}</div>}
      </section>
    </div>
  </main>;
}
