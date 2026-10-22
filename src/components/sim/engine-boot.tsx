"use client";

import { useEffect } from "react";
import { startEngine } from "@/lib/sim/engine";

/** Starts the simulation engine (leader-elected across tabs). Renders nothing. */
export function SimEngineBoot() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") return;
    startEngine();
  }, []);
  return null;
}
