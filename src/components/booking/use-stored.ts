"use client";

import { useCallback, useSyncExternalStore } from "react";

// A localStorage value read through useSyncExternalStore: null on the server
// and during hydration, the stored string after, and every component reading
// the same key updates when one of them writes.

const EVENT = "wilber:stored";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStored(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const write = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        /* private mode: keep going without persistence */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, write];
}
