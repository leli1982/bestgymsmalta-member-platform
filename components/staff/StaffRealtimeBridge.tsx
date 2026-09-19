"use client";

import { useEffect, useRef } from "react";
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
  // StaffDashboard renders a new connection-status callback on state updates.
  // Keep the subscription stable rather than reconnecting on every render.
  const queueChangedRef = useRef(onQueueChanged);
  const connectionChangeRef = useRef(onConnectionChange);
  queueChangedRef.current = onQueueChanged;
  connectionChangeRef.current = onConnectionChange;

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
          connectionChangeRef.current?.(false);
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
              void queueChangedRef.current();
            }
          )
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              connectionChangeRef.current?.(true);
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              connectionChangeRef.current?.(false);
            }
          });

        cleanup = async () => {
          await supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error(error);
        if (!cancelled) connectionChangeRef.current?.(false);
      }
    }

    const recover = () => void queueChangedRef.current();
    window.addEventListener("focus", recover);
    const recoverVisible = () => {
      if (document.visibilityState === "visible") recover();
    };
    document.addEventListener("visibilitychange", recoverVisible);
    void initialize();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recoverVisible);
      if (cleanup) void cleanup();
    };
  }, []);

  return null;
}
