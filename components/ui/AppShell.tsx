import { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import MotionPage from "@/components/ui/MotionPage";
import TopBar from "@/components/ui/TopBar";
import FirstTimeOnboarding from "@/components/onboarding/FirstTimeOnboarding";

type NavVariant = "dark" | "light";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  showLogo?: boolean;
  useTopBar?: boolean;
  navVariant?: NavVariant;
  theme?: NavVariant;
};

export default function AppShell({
  children,
  title,
  eyebrow = "BestGymsMalta",
  showLogo = true,
  useTopBar = true,
  theme = "dark",
  navVariant = theme,
}: AppShellProps) {
  return (
    <main className={`relative min-h-screen overflow-hidden pb-[calc(96px+env(safe-area-inset-bottom))] ${theme === "light" ? "bg-[#f6f6f6] text-zinc-950" : "bg-go text-white"}`}>
      {theme === "dark" && <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_85%_5%,rgba(252,180,21,0.28),transparent_30%),radial-gradient(circle_at_10%_45%,rgba(252,180,21,0.08),transparent_25%),linear-gradient(180deg,#090909_0%,#050505_100%)]" />

      <div className="pointer-events-none fixed inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,rgba(252,180,21,0.8)_1px,transparent_0)] bg-[length:28px_28px]" />

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.75)_100%)]" />

      </>}

      <MotionPage>
        <div className="relative z-10 mx-auto max-w-md px-5 pb-28 pt-8">
          {theme === "light" ? (
            <header className="mb-7 flex items-center justify-between gap-3">
              <a href="/" aria-label="BestGymsMalta home" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 p-1.5">
                  <img src="/bgm-logo.png" alt="" className="h-full w-full object-contain" />
                </span>
                <span>
                  <span className="block text-sm font-black tracking-tight">BestGymsMalta</span>
                  <span className="block text-[10px] font-semibold text-slate-500">More than gyms.</span>
                </span>
              </a>
              <a href="/card" className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-[#c2410c]">My card</a>
            </header>
          ) : useTopBar ? (
            <TopBar />
          ) : (
            (title || showLogo) && (
              <header className="mb-7 flex items-start justify-between gap-4">
                <div>
                  {title && (
                    <>
                      <p className="text-sm font-black uppercase tracking-[0.35em] text-primary">
                        {eyebrow}
                      </p>
                      <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-tight">
                        {title}
                      </h1>
                    </>
                  )}
                </div>

                {showLogo && (
                  <img
                    src="/logos/bgm-main.png"
                    alt="BestGymsMalta"
                    className="mt-1 w-24 object-contain drop-shadow-[0_0_18px_rgba(252,180,21,0.35)]"
                  />
                )}
              </header>
            )
          )}

          {children}
        </div>
      </MotionPage>

      <FirstTimeOnboarding />
      <BottomNav variant={navVariant} />
    </main>
  );
}
