"use client";

import { useEffect } from "react";

export default function JoinPwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/join-sw.js").catch(() => {
      // Registration is optional for the form itself; the live network path remains authoritative.
    });
  }, []);

  return null;
}
