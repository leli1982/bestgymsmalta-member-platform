import { Camera, QrCode } from "lucide-react";
import Button from "@/components/ui/Button";
import HeroCard from "@/components/ui/HeroCard";

export default function HomeHero() {
  return (
    <HeroCard imageSrc="/images/male-athlete.png" imageAlt="Male athlete">
      <div className="max-w-[62%]">
        <p className="mb-3 text-sm font-black uppercase text-primary">
          12 Day Streak
        </p>

        <h2 className="text-4xl font-black uppercase leading-none">
          Check In
          <br />
          <span className="text-primary">And Earn</span>
        </h2>

        <p className="mt-5 text-sm leading-relaxed text-zinc-300">
          Scan your gym QR, earn GO Points and keep your streak alive.
        </p>

        <div className="mt-7 grid gap-3">
          <Button href="/check-in">
            <QrCode size={20} />
            Check In
          </Button>

          <Button href="/check-in" variant="secondary">
            <Camera size={20} />
            Create Story
          </Button>
        </div>
      </div>
    </HeroCard>
  );
}