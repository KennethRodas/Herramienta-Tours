"use client";

import { useEffect } from "react";
import { startEngine } from "@/lib/sim/engine";

const SHARED_TICK_MS = 20_000;

/**
 * Simulation: starts the in-browser engine (leader-elected across tabs).
 * Shared mode: the server runs the automations; open, visible pages nudge it
 * every 20 s so reminders and replies go out even without a cron.
 * Renders nothing.
 */
export function SimEngineBoot() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
      startEngine();
      return;
    }
    const tick = () => {
      if (document.visibilityState === "visible") void fetch("/api/sim/tick", { method: "POST" }).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, SHARED_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
