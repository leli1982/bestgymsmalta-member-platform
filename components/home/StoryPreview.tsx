import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

export default function StoryPreview() {
  return (
    <Card className="mt-5">
      <SectionTitle eyebrow="Social" title="Story Preview" />

      <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-[#fcb415] bg-black p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(252,180,21,0.55),transparent_40%)]" />

        <img
          src="/images/female-athlete.png"
          alt="Female athlete"
          className="absolute bottom-0 right-0 h-full w-[56%] object-cover object-bottom opacity-90"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

        <div className="relative z-10 max-w-[52%]">
          <p className="text-xs font-black tracking-[0.35em] text-[#fcb415]">
            BESTGYMSMALTA
          </p>

          <h4 className="mt-4 text-3xl font-black leading-none">
            WORKOUT
            <br />
            COMPLETE
          </h4>

          <p className="mt-4 text-sm text-zinc-300">📍 Pembroke Fitness</p>

          <p className="mt-3 text-5xl font-black text-[#fcb415]">78 MIN</p>

          <p className="text-sm text-zinc-300">620 calories burned</p>

          <p className="mt-6 text-lg font-black">
            Be the Best...
            <br />
            <span className="text-[#fcb415]">Beat the Rest</span>
          </p>
        </div>
      </div>
    </Card>
  );
}