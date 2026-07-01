import { Mail, Lock, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-between">
        <div>
          <img
            src="/logos/bgm-horizontal.png"
            alt="BestGymsMalta"
            className="w-44"
          />

          <div className="mt-12">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-500">
              BestGyms GO
            </p>
            <h1 className="mt-3 text-6xl font-black uppercase leading-none">
              Welcome
              <br />
              Back
            </h1>
            <p className="mt-4 text-zinc-400">
              Check in, earn points, unlock gyms and share your progress.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4">
              <Mail className="text-orange-500" size={20} />
              <input
                placeholder="Email address"
                className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
              />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4">
              <Lock className="text-orange-500" size={20} />
              <input
                type="password"
                placeholder="Password"
                className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
              />
            </div>

            <Button className="w-full">
              Continue <ArrowRight size={20} />
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-zinc-500">
          Powered by BestGymsMalta
        </p>
      </div>
    </main>
  );
}