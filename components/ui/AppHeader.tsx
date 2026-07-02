type AppHeaderProps = {
  greeting?: string;
  name?: string;
};

export default function AppHeader({
  greeting = "Good Evening",
  name = "Leli",
}: AppHeaderProps) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-500">
          {greeting}
        </p>
        <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-tight">
          {name}
        </h1>
      </div>

      <img
        src="/logos/bgm-horizontal.png"
        alt="BestGymsMalta"
        className="mt-1 w-36 object-contain"
      />
    </header>
  );
}