"use client";

import { useEffect } from "react";
import { createStaffRealtimeClient } from "@/lib/supabaseStaffBrowser";

type RealtimeConfig =
  | { enabled: false }
  | {
      enabled: true;
      topic: string;
      supabaseUrl: string;
      publishableKey: string;
    };

type Props = {
  onQueueChanged: () => void | Promise<void>;
  onConnectionChange?: (connected: boolean) => void;
};

export default function StaffRealtimeBridge({
  onQueueChanged,
  onConnectionChange,
}: Props) {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => Promise<void>) | null = null;

    async function initialize() {
      try {
        const response = await fetch("/api/system/staff/realtime", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Could not load Realtime configuration.");
        const config = (await response.json()) as RealtimeConfig;
        if (cancelled || !config.enabled) {
          onConnectionChange?.(false);
          return;
        }

        const supabase = createStaffRealtimeClient(
          config.supabaseUrl,
          config.publishableKey
        );
        const channel = supabase
          .channel(config.topic)
          .on(
            "broadcast",
            { event: "membership-queue-changed" },
            () => {
              void onQueueChanged();
            }
          )
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              onConnectionChange?.(true);
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              onConnectionChange?.(false);
            }
          });

        cleanup = async () => {
          await supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error(error);
        if (!cancelled) onConnectionChange?.(false);
      }
    }

    const recover = () => void onQueueChanged();
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    void initialize();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      if (cleanup) void cleanup();
    };
  }, [onConnectionChange, onQueueChanged]);

  return null;
}
