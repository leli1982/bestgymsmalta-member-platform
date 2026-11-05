"use client";

import { useState } from "react";

export default function DeveloperRecoveryForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const resetting = Boolean(token);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setSending(true);
    try {
      if (resetting && password !== confirm) {
        setError("The passwords do not match."); return;
      }
      const response = await fetch("/api/system/developer/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(resetting ? { mode: "reset", token, password } : { mode: "request" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Recovery could not be completed.");
      if (resetting) {
        setPassword(""); setConfirm("");
        setMessage("Password changed. Return to Staff & Reception and sign in with your Developer username.");
      } else setMessage(data.message || "Check the registered recovery email.");
    } catch (err) { setError(err instanceof Error ? err.message : "Recovery failed."); }
    finally { setSending(false); }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-900">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
        <h1 className="mt-3 text-2xl font-black">Developer account recovery</h1>
        <p className="mt-2 text-sm text-zinc-600">{resetting
          ? "Enter a new password of at least 14 characters. Reset links expire after 15 minutes and can be used once."
          : "Request a single-use recovery link to the protected developer address. Standard administrators cannot access this process."}</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {!message && <form onSubmit={submit} className="mt-5 space-y-4">
          {resetting && <>
            <label className="block text-sm font-bold">New password
              <input type="password" autoComplete="new-password" minLength={14} maxLength={128} required
                value={password} onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-4 py-3" />
            </label>
            <label className="block text-sm font-bold">Confirm password
              <input type="password" autoComplete="new-password" minLength={14} maxLength={128} required
                value={confirm} onChange={(event) => setConfirm(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-4 py-3" />
            </label>
          </>}
          <button disabled={sending} className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-bold text-white disabled:opacity-50">
            {sending ? "Processing…" : resetting ? "Set new password" : "Email recovery link"}
          </button>
        </form>}
        <a href="/staff" className="mt-6 inline-block text-sm font-bold text-orange-700 underline">Return to Staff & Reception</a>
      </div>
    </main>
  );
}
