import AppShell from "@/components/ui/AppShell";

export default function StoryPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-500">
            Story Creator
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Share your BGM story
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Add the official BGM watermark to your gym photo, resize it, move it
            and share it to your socials.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-lg font-black text-white">Coming next</p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            This will become the photo editor for Instagram, Facebook and TikTok
            sharing. We will build the upload, moveable watermark and export
            tools here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}