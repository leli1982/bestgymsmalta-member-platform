import Link from "next/link";

export default function LoginPage() {
  return (
    <main data-member-surface="legacy-login-light" className="min-h-screen bg-[#f6f6f6] px-5 py-10 text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="overflow-hidden rounded-[2.2rem] border border-zinc-200 bg-white shadow-xl">
          <section className="relative bg-zinc-950 p-7">
            <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 p-2">
                <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-full w-full object-contain" />
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">BestGymsMalta</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white">Your member platform</h1>
              <p className="mt-4 text-sm font-bold leading-6 text-white/60">Access your membership card, track your passport, find gyms and create branded BGM stories.</p>
            </div>
          </section>

          <div className="p-6">
            <Link href="/" className="flex w-full items-center justify-center rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100">Enter App</Link>
            <p className="mt-5 text-center text-xs font-black uppercase tracking-[.18em] text-zinc-400">Be the best... Beat the rest.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
