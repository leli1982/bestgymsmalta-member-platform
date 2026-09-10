"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";

type PreviewIssue = {
  rowNumber: number;
  action: "conflict" | "invalid";
  membershipNumber: string;
  customerName: string;
  gym: string;
  pkCustomer: string;
  issue: string;
};

type ImportPreview = {
  batchId: string;
  filename: string;
  fileFormat: "xlsx" | "csv";
  importMode: "legacy_15" | "exchange_16";
  totalRows: number;
  newRows: number;
  updateRows: number;
  unchangedRows: number;
  conflictRows: number;
  invalidRows: number;
  issues: PreviewIssue[];
};

type ApplyResult = {
  applied: boolean;
  batchId?: string;
  totalRows?: number;
  newRows?: number;
  updateRows?: number;
  unchangedRows?: number;
  generatedCount?: number;
  firstGenerated?: string | null;
  lastGenerated?: string | null;
};

export default function MembershipDataAdmin({
  onApplied,
}: {
  onApplied?: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [applying, setApplying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<ApplyResult | null>(null);

  function resetPreview(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setApplied(null);
    setMessage("");
    setError("");
  }

  async function previewImport() {
    if (!file) return;
    setPreviewing(true);
    setMessage("");
    setError("");
    setApplied(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/members/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not prepare the import preview.");
      }
      setPreview(data);
      setMessage(
        data.conflictRows || data.invalidRows
          ? "Preview complete. Resolve the highlighted rows in Excel and preview the file again."
          : "Preview complete. No blocking rows found; review the totals before confirming."
      );
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not prepare the import preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmImport() {
    if (!preview || preview.conflictRows > 0 || preview.invalidRows > 0) return;
    setApplying(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/members/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: preview.batchId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not apply the membership import.");
      }

      setApplied(data);
      setMessage(
        `Import applied. ${data.newRows || 0} new, ${data.updateRows || 0} updated, ${data.unchangedRows || 0} unchanged.`
      );
      await onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply the membership import.");
    } finally {
      setApplying(false);
    }
  }

  const canConfirm = Boolean(
    preview &&
      !applied &&
      preview.conflictRows === 0 &&
      preview.invalidRows === 0
  );

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-[#fcb415]" size={26} strokeWidth={3} />
            <h2 className="text-2xl font-black">Membership Data</h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-white/50">
            Exchange the complete BGM membership list as XLSX or CSV. Uploading a file only creates a preview; nothing changes until you explicitly confirm the import.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/members/export?format=xlsx"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
          >
            <Download size={17} /> Download XLSX
          </a>
          <a
            href="/api/admin/members/export?format=csv"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
          >
            <Download size={17} /> Download CSV
          </a>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => resetPreview(event.target.files?.[0] || null)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:font-black file:text-white"
          />
          <button
            type="button"
            onClick={previewImport}
            disabled={!file || previewing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#fcb415] px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {previewing ? <RefreshCw size={17} className="animate-spin" /> : <Upload size={17} />}
            {previewing ? "Checking…" : "Preview Import"}
          </button>
        </div>
        <p className="mt-3 text-xs font-bold text-white/40">
          Accepted formats: the original 15-column legacy XLSX/CSV or the BGM 16-column exchange format with MembershipNumber first.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-white/70">
          {message}
        </div>
      )}

      {preview && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">Preview</p>
              <p className="mt-1 font-black text-white">{preview.filename}</p>
              <p className="mt-1 text-xs font-bold text-white/45">
                {preview.importMode === "legacy_15" ? "Legacy 15-column file" : "BGM 16-column exchange file"}
              </p>
            </div>
            <button
              type="button"
              onClick={confirmImport}
              disabled={!canConfirm || applying}
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-35"
            >
              {applying ? "Applying…" : applied ? "Import Applied" : "Confirm Import"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <SummaryCard label="Rows" value={preview.totalRows} />
            <SummaryCard label="New" value={preview.newRows} />
            <SummaryCard label="Updates" value={preview.updateRows} />
            <SummaryCard label="Unchanged" value={preview.unchangedRows} />
            <SummaryCard label="Conflicts" value={preview.conflictRows} danger={preview.conflictRows > 0} />
            <SummaryCard label="Invalid" value={preview.invalidRows} danger={preview.invalidRows > 0} />
            <SummaryCard label="Deletions" value={0} />
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs font-bold leading-5 text-emerald-100/80">
            This import is non-destructive. Members omitted from the uploaded file are not deleted or archived.
          </div>

          {preview.issues.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-red-500/20">
              <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100">
                Rows requiring review {preview.conflictRows + preview.invalidRows > 100 ? "(first 100 shown)" : ""}
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-950 text-white/45">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Membership</th>
                      <th className="px-3 py-2">Member</th>
                      <th className="px-3 py-2">Gym / PK</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues.map((issue) => (
                      <tr key={`${issue.rowNumber}-${issue.action}`} className="border-t border-white/5 bg-black/20 align-top text-white/70">
                        <td className="px-3 py-3 font-black">{issue.rowNumber}</td>
                        <td className="px-3 py-3 font-black uppercase text-red-300">{issue.action}</td>
                        <td className="px-3 py-3">{issue.membershipNumber || "—"}</td>
                        <td className="px-3 py-3">{issue.customerName || "—"}</td>
                        <td className="px-3 py-3">{issue.gym || "—"}{issue.pkCustomer ? ` · ${issue.pkCustomer}` : ""}</td>
                        <td className="px-3 py-3">{issue.issue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {applied && (applied.generatedCount || 0) > 0 && (
            <div className="rounded-2xl border border-[#fcb415]/25 bg-[#fcb415]/10 p-4 text-sm font-bold text-[#ffe3a0]">
              Generated {applied.generatedCount} permanent membership number{applied.generatedCount === 1 ? "" : "s"}
              {applied.firstGenerated ? ` from ${applied.firstGenerated}` : ""}
              {applied.lastGenerated && applied.lastGenerated !== applied.firstGenerated ? ` to ${applied.lastGenerated}` : ""}.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${danger ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-black/20"}`}>
      <div className={`text-2xl font-black ${danger ? "text-red-300" : "text-white"}`}>{value.toLocaleString()}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[.14em] text-white/40">{label}</div>
    </div>
  );
}
