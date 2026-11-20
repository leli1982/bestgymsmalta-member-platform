"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ArrowLeft, ImageUp, RotateCcw } from "lucide-react";

const DEFAULT_HERO = "/visuals/home-hero-duo.jpg";

export default function MemberDashboardImagePage() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sessionResponse = await fetch("/api/system/auth", { cache: "no-store" });
        const session = await sessionResponse.json();
        if (!sessionResponse.ok || !session?.user?.isSuperAdmin) {
          throw new Error("Super Admin access is required.");
        }
        const response = await fetch("/api/member/home-hero", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load the dashboard image.");
        const data = await response.json();
        if (active) setCurrentUrl(typeof data.imageUrl === "string" ? data.imageUrl : null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the image.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setError("");
    setNotice("");
    if (selected && (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5 * 1024 * 1024 || selected.size < 1)) {
      setError("Please select a JPG, PNG or WebP image up to 5 MB.");
      setFile(null);
    } else setFile(selected);
    event.target.value = "";
  }

  async function publish() {
    if (!file || working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/system/admin/member-home-hero", {
        method: "POST", credentials: "same-origin", body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not publish the image.");
      setCurrentUrl(typeof result.imageUrl === "string" ? result.imageUrl : null);
      setFile(null);
      setNotice("Published successfully. Members will see the new image when they open or return to their dashboard.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish the image.");
    } finally {
      setWorking(false);
    }
  }

  async function reset() {
    if (working || !currentUrl || !window.confirm("Restore the original BGM dashboard image for every member?")) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/system/admin/member-home-hero", {
        method: "DELETE", credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not restore the original image.");
      setCurrentUrl(null);
      setFile(null);
      setNotice("Original BGM dashboard image restored.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore the original image.");
    } finally {
      setWorking(false);
    }
  }

  const chosenUrl = previewUrl || currentUrl || DEFAULT_HERO;

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700"><ArrowLeft size={16} /> Super Admin</a>
          <h1 className="mt-4 text-2xl font-black">Member Dashboard Image</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Change the large welcome-picture background seen by members after login. The member greeting, logo, notifications and buttons stay unchanged.</p>
        </header>

        {error ? <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p> : null}
        {notice ? <p role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{notice}</p> : null}

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Upload a new image</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Choose a high-resolution JPG, PNG or WebP up to 5 MB. A portrait or near-square composition works best. Keep important faces and details away from the left side so the welcome text remains readable.</p>
            <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-7 text-sm font-black text-orange-800">
              <ImageUp size={22} />
              {file ? "Choose another image" : "Choose image"}
              <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={onChoose} disabled={working || loading} />
            </label>
            {file ? <p className="mt-3 text-sm text-zinc-600">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p> : null}
            <button type="button" onClick={() => void publish()} disabled={!file || working || loading || Boolean(error)} className="mt-5 w-full rounded-2xl bg-orange-600 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
              {working ? "Saving…" : "Publish dashboard image"}
            </button>
            <p className="mt-2 text-xs leading-5 text-zinc-500">The image changes only after you click Publish. No app rebuild or redeployment is required for future uploads.</p>
            <div className="mt-6 border-t border-zinc-200 pt-5">
              <h3 className="text-sm font-black">Current published image</h3>
              <p className="mt-1 text-sm text-zinc-600">{loading ? "Checking…" : currentUrl ? "Custom image" : "Original BGM image"}</p>
              <button type="button" onClick={() => void reset()} disabled={!currentUrl || working || loading} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-800 disabled:opacity-40">
                <RotateCcw size={16} /> Restore original image
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-lg font-black">Dashboard preview</h2>
            <p className="mb-4 text-sm text-zinc-500">{previewUrl ? "Preview — not yet published" : "Currently published"}</p>
            <div className="relative mx-auto h-[500px] max-w-[390px] overflow-hidden rounded-[1.7rem] bg-black bg-cover bg-[38%_center] text-white shadow-lg"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.58) 34%, rgba(0,0,0,.08) 72%, rgba(0,0,0,.04) 100%), linear-gradient(180deg, rgba(0,0,0,.04) 0%, rgba(0,0,0,.02) 58%, rgba(0,0,0,.48) 100%), url(${JSON.stringify(chosenUrl)})` }}>
              <div className="absolute inset-0 flex flex-col p-5">
                <div className="flex items-center gap-2"><img src="/bgm-logo.png" alt="BestGymsMalta" className="h-10 w-10 object-contain" /><span className="text-[11px] font-black">WWW.BESTGYMSMALTA.COM</span></div>
                <div className="mt-auto mb-20 max-w-[70%]">
                  <p className="text-3xl font-black leading-tight">Welcome back,</p>
                  <p className="text-4xl font-black text-[#ff5a0a]">Member</p>
                  <p className="mt-2 whitespace-nowrap text-sm">be the best...beat the rest</p>
                </div>
                <div className="absolute bottom-5 left-5 right-5 grid grid-cols-2 gap-3 text-center text-sm font-black">
                  <div className="rounded-xl bg-[#ff5a0a] px-2 py-4">Show Card</div>
                  <div className="rounded-xl border-2 border-[#ff5a0a] bg-black/60 px-2 py-4">Find Gyms</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Illustrative mobile preview; verify the final appearance in the Members App Preview before taking this feature live.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
