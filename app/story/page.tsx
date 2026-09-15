import AppShell from "@/components/ui/AppShell";
import StoryCreator from "@/components/story/StoryCreator";

export default function StoryPage() {
  return (
    <AppShell theme="light">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-[#ff5a0a]">
            Story Creator
          </p>
          <h1 className="mt-2 text-3xl font-black text-zinc-950">
            Share your BGM story
          </h1>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">
            Add the official BGM watermark, resize it, move it and share your
            gym photo.
          </p>
        </div>

        <StoryCreator />
      </div>
    </AppShell>
  );
}
