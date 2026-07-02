import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-500">
            BestGymsMalta
          </p>

          <h1 className="mt-4 text-4xl font-black leading-tight">
            Your member platform
          </h1>

          <p className="mt-4 text-sm leading-6 text-white/55">
            Access your membership card, track your passport, find gyms and
            create branded BGM stories.
          </p>

          <Link
            href="/"
            className="mt-7 flex w-full items-center justify-center rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
          >
            Enter App
          </Link>

          <p className="mt-5 text-center text-xs font-bold text-white/35">
            Be the best.... Beat the rest
          </p>
        </div>
      </div>
    </main>
  );
}
