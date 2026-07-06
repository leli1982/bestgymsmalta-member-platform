import { Camera, CreditCard, MapPinned } from "lucide-react";

export default function HomeHero() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#fcb415]/20 via-white/[0.04] to-black p-6">
      <div className="inline-flex rounded-full border border-[#fcb415]/30 bg-[#fcb415]/10 px-4 py-2">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#fcb415]">
          Active Member
        </p>
      </div>

      <h1 className="mt-5 text-4xl font-black leading-tight text-white">
        Your BGM membership companion
      </h1>

      <p className="mt-4 text-sm leading-6 text-white/55">
        Use your digital card, build your gym passport, find locations and share
        branded BGM stories.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <a
          href="/card"
          className="rounded-3xl border border-white/10 bg-black/25 p-4 text-center"
        >
          <CreditCard className="mx-auto text-[#fcb415]" size={24} />
          <p className="mt-2 text-xs font-black text-white">Card</p>
        </a>

        <a
          href="/passport"
          className="rounded-3xl border border-white/10 bg-black/25 p-4 text-center"
        >
          <MapPinned className="mx-auto text-[#fcb415]" size={24} />
          <p className="mt-2 text-xs font-black text-white">Passport</p>
        </a>

        <a
          href="/story"
          className="rounded-3xl border border-white/10 bg-black/25 p-4 text-center"
        >
          <Camera className="mx-auto text-[#fcb415]" size={24} />
          <p className="mt-2 text-xs font-black text-white">Story</p>
        </a>
      </div>
    </section>
  );
}
