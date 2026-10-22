"use client";

import { useEffect, useState } from "react";

export interface IntegrationStatus {
  mode: "simulacion" | "supabase";
  supabase: boolean;
  kapso: boolean;
  kapsoWebhookSecret: boolean;
  resend: boolean;
  wompi: boolean;
  whatsappTestNumbers: string[];
  emailTestAddresses: number;
}

/** Reads /api/estado once. null while loading or when the route is unreachable. */
export function useIntegrations() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setStatus(j))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
