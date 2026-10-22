"use client";

import { useEffect, useRef, useState } from "react";
import { sim } from "@/lib/sim/store";

// Real WhatsApp → simulated data. While enabled, polls /api/whatsapp/inbox for
// messages the tester sent to the business number (Kapso) and feeds them to
// the simulation as if Wilber had typed them; the bot's answer goes back out
// through Kapso when "WhatsApp real" is on.

export type BridgeState = "apagado" | "escuchando" | "error";

export function useRealWhatsAppBridge(enabled: boolean, intervalMs = 5000) {
  const [state, setState] = useState<BridgeState>("apagado");
  const [lastError, setLastError] = useState<string | null>(null);
  const since = useRef<string>(new Date().toISOString());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    since.current = new Date().toISOString();
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/whatsapp/inbox?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; error?: string; messages: { id: string; text: string; createdAt: string }[] };
        if (!json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setState("escuchando");
        setLastError(null);
        for (const m of json.messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
          if (seen.current.has(m.id)) continue;
          seen.current.add(m.id);
          since.current = m.createdAt;
          await sim.wilberSays(m.text);
        }
      } catch (e) {
        setState("error");
        setLastError((e as Error).message);
      }
    };
    void poll();
    const id = window.setInterval(() => {
      if (!stop) void poll();
    }, intervalMs);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);

  return { state: enabled ? state : ("apagado" as BridgeState), lastError };
}
