type ChallengeCardProps = {
  title: string;
  description: string;
  detail?: string;
  href?: string;
};

export default function ChallengeCard({
  title,
  description,
  detail = "Stay consistent",
  href = "/goals",
}: ChallengeCardProps) {
  return (
    <a
      href={href}
      className="block rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.07] active:scale-[0.98]"
    >
      <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
        Fitness Focus
      </p>

      <h3 className="mt-3 text-xl font-black text-white">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>

      <p className="mt-4 text-sm font-black text-orange-500">{detail}</p>
    </a>
  );
}
