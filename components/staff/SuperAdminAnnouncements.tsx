"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, Megaphone, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";

type Announcement = {
  id?: string; title: string; message: string; category: string;
  image_url: string; button_text: string; button_url: string;
  active: boolean; start_date: string; end_date: string; sort_order: number;
  created_at?: string;
};
const blank = (): Announcement => ({
  title: "", message: "", category: "Update", image_url: "", button_text: "",
  button_url: "", active: true, start_date: "", end_date: "", sort_order: 0,
});
const input = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-950 focus:border-orange-500 focus:outline-none";
const asForm = (row: Announcement): Announcement => ({
  ...row, image_url: row.image_url || "", button_text: row.button_text || "",
  button_url: row.button_url || "", start_date: row.start_date || "",
  end_date: row.end_date || "", category: row.category || "Update",
});

export default function SuperAdminAnnouncements() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState<Announcement>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/system/admin/announcements", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load announcements.");
    setItems((data.announcements || []).map(asForm));
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/system/auth", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        const allowed = Boolean(response.ok && data.authenticated && data.user?.isSuperAdmin);
        setAuthorized(allowed);
        if (allowed) await load();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to check Super Admin access.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [load]);

  function change(fields: Partial<Announcement>) {
    setForm(current => ({ ...current, ...fields }));
  }
  function reset() {
    setEditingId(null); setForm(blank()); setError(""); setMessage("");
  }
  function edit(item: Announcement) {
    setEditingId(item.id || null); setForm(asForm(item)); setError(""); setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function action(mode: "create" | "update" | "delete", item: Announcement, id?: string) {
    const response = await fetch("/api/system/admin/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, id: id || item.id, item }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save announcement.");
    return data;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    if (!form.title.trim() || !form.message.trim()) {
      setError("Enter an announcement title and message."); return;
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      setError("End date must not be before start date."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await action(editingId ? "update" : "create", form, editingId || undefined);
      await load();
      setEditingId(null); setForm(blank());
      setMessage(editingId ? "Announcement updated." : "Announcement saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save announcement.");
    } finally { setBusy(false); }
  }
  async function toggle(item: Announcement) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await action("update", { ...item, active: !item.active });
      await load();
      setMessage(item.active ? "Announcement hidden from members." : "Announcement activated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change announcement status.");
    } finally { setBusy(false); }
  }
  async function remove(item: Announcement) {
    if (busy || !item.id || !window.confirm("Delete this announcement permanently?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await action("delete", item);
      if (editingId === item.id) { setEditingId(null); setForm(blank()); }
      await load();
      setMessage("Announcement deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete announcement.");
    } finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || busy || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("Choose a JPG, PNG or WebP image up to 5 MB."); return;
    }
    setUploading(true); setError(""); setMessage("");
    try {
      const payload = new FormData(); payload.append("file", file);
      const response = await fetch("/api/system/admin/announcements/upload", {
        method: "POST", body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      change({ image_url: data.imageUrl });
      setMessage("Image uploaded. Save the announcement to publish it.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload image.");
    } finally { setUploading(false); }
  }

  if (authorized === null) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-800">Checking Super Admin access…{error && <p role="alert">{error}</p>}</main>;
  if (!authorized) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Super Admin access required. <a href="/staff" className="underline">Staff Home</a></main>;
  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft size={17}/> Super Admin</a>
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-2xl bg-orange-50 p-3 text-orange-700"><Megaphone size={30}/></span>
            <div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Members App · News</p>
              <h1 className="text-3xl font-black">Announcements</h1>
              <p className="mt-1 text-sm text-zinc-600">Manage the news shown on the Members App home page.</p></div>
          </div>
        </header>
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p>}
        <form onSubmit={save} className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Announcement editor">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black">{editingId ? "Edit announcement" : "New announcement"}</h2>
            {editingId && <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold"><X size={17}/> Cancel edit</button>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold sm:col-span-2">Title
              <input aria-label="Announcement title" required maxLength={200} value={form.title} onChange={e => change({ title: e.target.value })} className={input} placeholder="e.g. Public holiday opening hours"/>
            </label>
            <label className="text-sm font-bold sm:col-span-2">Message
              <textarea aria-label="Announcement message" required rows={4} maxLength={8000} value={form.message} onChange={e => change({ message: e.target.value })} className={input} placeholder="What should members know?"/>
            </label>
            <label className="text-sm font-bold">Category
              <input aria-label="Announcement category" maxLength={120} value={form.category} onChange={e => change({ category: e.target.value })} className={input} placeholder="News, Public Holiday, Event…"/>
            </label>
            <label className="text-sm font-bold">Display order <span className="font-normal text-zinc-500">(smaller first)</span>
              <input aria-label="Announcement display order" type="number" step="1" min="-1000000" max="1000000" value={form.sort_order} onChange={e => change({ sort_order: Number(e.target.value) })} className={input}/>
            </label>
            <label className="text-sm font-bold">Start date <span className="font-normal text-zinc-500">(optional)</span>
              <input aria-label="Announcement start date" type="date" value={form.start_date} onChange={e => change({ start_date: e.target.value })} className={input}/>
            </label>
            <label className="text-sm font-bold">End date <span className="font-normal text-zinc-500">(optional)</span>
              <input aria-label="Announcement end date" type="date" value={form.end_date} onChange={e => change({ end_date: e.target.value })} className={input}/>
            </label>
            <label className="text-sm font-bold sm:col-span-2">Image URL or public path <span className="font-normal text-zinc-500">(optional)</span>
              <input aria-label="Announcement image URL" value={form.image_url} onChange={e => change({ image_url: e.target.value })} className={input} placeholder="https://... or /visuals/..."/>
            </label>
            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-black text-orange-800">
                <ImagePlus size={19}/>{uploading ? "Uploading image…" : "Upload image"}
                <input aria-label="Upload announcement image" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || busy} className="sr-only" onChange={event => {
                  const file = event.target.files?.[0]; event.target.value = "";
                  void upload(file);
                }}/>
              </label>
              <p className="mt-2 text-xs text-zinc-500">JPG, PNG or WebP · maximum 5 MB.</p>
            </div>
            <label className="text-sm font-bold">Button text <span className="font-normal text-zinc-500">(optional)</span>
              <input aria-label="Announcement button text" maxLength={120} value={form.button_text} onChange={e => change({ button_text: e.target.value })} className={input} placeholder="Read more"/>
            </label>
            <label className="text-sm font-bold">Button link <span className="font-normal text-zinc-500">(optional)</span>
              <input aria-label="Announcement button URL" value={form.button_url} onChange={e => change({ button_url: e.target.value })} className={input} placeholder="https://... or /gyms"/>
            </label>
          </div>
          <div className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 p-4" aria-label="Announcement preview">
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">Member preview</p>
            <h3 className="mt-2 text-xl font-black">{form.title || "Announcement title"}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{form.message || "Your message appears here."}</p>
            {form.image_url && <img src={form.image_url} alt="" className="mt-3 h-40 w-full rounded-xl object-cover"/>}
            <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{form.category || "Update"}</span>
              {form.button_text && <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">{form.button_text}</span>}</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-black"><input aria-label="Announcement active" type="checkbox" checked={form.active} onChange={e => change({ active: e.target.checked })}/> Active (show within its scheduled dates)</label>
            <button type="submit" disabled={busy || uploading || loading} className="inline-flex items-center gap-2 rounded-xl bg-[#ff5a0a] px-5 py-3 font-black text-white disabled:opacity-50">
              {editingId ? <Save size={18}/> : <Plus size={18}/>} {busy ? "Saving…" : editingId ? "Save changes" : "Create announcement"}
            </button>
          </div>
        </form>
        <section aria-label="Existing announcements" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black">Existing announcements ({items.length})</h2>
            <button type="button" disabled={loading || busy} onClick={() => { setLoading(true); setError(""); load().catch(e => setError(String(e))).finally(() => setLoading(false)); }}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black"><RefreshCw size={17}/> Refresh</button>
          </div>
          {loading && <p className="rounded-xl bg-white p-5 text-sm text-zinc-500">Loading announcements…</p>}
          {!loading && items.length === 0 && <p className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">No announcements in this environment yet. Create one above.</p>}
          {items.map(item => <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wider text-orange-700">{item.category || "Update"} · {item.active ? "Active" : "Hidden"}</p>
                <h3 className="mt-1 text-xl font-black">{item.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{item.message}</p>
                {(item.start_date || item.end_date) && <p className="mt-2 text-xs text-zinc-500">Schedule: {item.start_date || "Any date"} → {item.end_date || "No end date"}</p>}
                {item.button_text && item.button_url && <p className="mt-2 break-all text-xs text-orange-700">Button: {item.button_text} · {item.button_url}</p>}
              </div>
              {item.image_url && <img src={item.image_url} alt="" className="h-24 w-24 rounded-xl object-cover"/>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              <button type="button" disabled={busy} onClick={() => edit(item)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-black"><Pencil size={16}/> Edit</button>
              <button type="button" disabled={busy} onClick={() => void toggle(item)}
                className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-800">{item.active ? "Hide" : "Activate"}</button>
              <button type="button" disabled={busy} onClick={() => void remove(item)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700"><Trash2 size={16}/> Delete</button>
            </div>
          </article>)}
        </section>
      </div>
    </main>
  );
}
