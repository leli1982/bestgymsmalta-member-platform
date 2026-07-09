import { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import MotionPage from "@/components/ui/MotionPage";
import TopBar from "@/components/ui/TopBar";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  showLogo?: boolean;
  useTopBar?: boolean;
};

export default function AppShell({
  children,
  title,
  eyebrow = "BestGymsMalta",
  showLogo = true,
  useTopBar = true,
}: AppShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-go text-white pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_85%_5%,rgba(252,180,21,0.28),transparent_30%),radial-gradient(circle_at_10%_45%,rgba(252,180,21,0.08),transparent_25%),linear-gradient(180deg,#090909_0%,#050505_100%)]" />

      <div className="pointer-events-none fixed inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,rgba(252,180,21,0.8)_1px,transparent_0)] bg-[length:28px_28px]" />

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.75)_100%)]" />

      <MotionPage>
        <div className="relative z-10 mx-auto max-w-md px-5 pb-28 pt-8">
          {useTopBar ? (
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

      <BottomNav />
    </main>
  );
}