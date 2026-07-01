import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

const gyms = [
  { name: "Birkirkara Fitness", visited: true },
  { name: "Birzebbuga Fitness", visited: false },
  { name: "Build Fitness", visited: true },
  { name: "Kirkop Fitness", visited: true },
  { name: "Marsa Fitness", visited: false },
  { name: "Marsascala Fitness", visited: false },
  { name: "Neptunes Fitness", visited: true },
  { name: "Pembroke Fitness", visited: true },
  { name: "Sliema Fitness", visited: false },
  { name: "Tal-Qroqq Fitness", visited: true },
];

export default function PassportPreview() {
  return (
    <Card className="mt-5">
      <SectionTitle eyebrow="Progress" title="Gym Passport" action="Active" />

      <div className="grid grid-cols-2 gap-3">
        {gyms.map((gym) => (
          <div
            key={gym.name}
            className={`rounded-xl border p-4 ${
              gym.visited
                ? "border-orange-500 text-white"
                : "border-white/15 text-zinc-500"
            }`}
          >
            <p className="font-black">{gym.name}</p>
            <p
              className={`mt-1 text-sm ${
                gym.visited ? "text-orange-500" : "text-zinc-500"
              }`}
            >
              {gym.visited ? "Visited" : "Locked"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}