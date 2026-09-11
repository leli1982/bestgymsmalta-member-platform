import IssueNewCardPanel from "@/components/staff/IssueNewCardPanel";

export const dynamic = "force-dynamic";

export default function IssueNewCardPage() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">BestGymsMalta · Reception</p>
            <h1 className="mt-1 text-3xl font-black">Issue New Card</h1>
            <p className="mt-1 text-sm text-zinc-600">For lost, stolen or damaged membership cards. Membership dates stay unchanged.</p>
          </div>
          <a href="/staff/reception" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold">Back to Reception</a>
        </header>
        <IssueNewCardPanel />
      </div>
    </main>
  );
}
