"use client";

import { useSyncExternalStore } from "react";
import type { Customer } from "@/lib/domain/types";
import { useHydrated, useSimState } from "./hooks";

// Visitor session in this browser: the WhatsApp number that entered with a code.
// The account itself (name, email) lives in the simulation state, shared by tabs.

const KEY = "wilber.cliente.v1";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function setCustomerSession(phone: string | null) {
  try {
    if (phone) window.localStorage.setItem(KEY, phone);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode: session lasts this page only */
  }
  for (const l of listeners) l();
}

export function useCustomer(): { customer: Pick<Customer, "phone" | "name" | "email"> | null; ready: boolean; logout: () => void } {
  const phone = useSyncExternalStore(subscribe, read, () => null);
  const hydrated = useHydrated();
  const state = useSimState();
  const record = phone && state ? state.customers.find((c) => c.phone === phone) : undefined;
  return {
    customer: record ? { phone: record.phone, name: record.name, email: record.email } : null,
    ready: hydrated && state !== null,
    logout: () => setCustomerSession(null),
  };
}
