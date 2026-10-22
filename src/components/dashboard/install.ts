"use client";

import { useSyncExternalStore } from "react";

// Chrome and Edge fire `beforeinstallprompt` once, early. The panel shell
// starts listening on every /wilber page so /wilber/instalar can offer a
// one-tap "Instalar" even if Wilber opened it later.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function captureInstallPrompt() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", cb);
  return () => {
    listeners.delete(cb);
    mq?.removeEventListener?.("change", cb);
  };
}

export function useInstallPrompt() {
  return useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return installedNow || Boolean(window.matchMedia?.("(display-mode: standalone)").matches) || nav.standalone === true;
}

/** undefined on the server, then whether this window runs as the installed app. */
export function useInstalled() {
  return useSyncExternalStore(subscribe, isStandalone, () => undefined);
}

export async function runInstallPrompt() {
  const ev = deferred;
  if (!ev) return "sin-prompt" as const;
  await ev.prompt();
  const choice = await ev.userChoice;
  deferred = null;
  emit();
  return choice.outcome;
}

export type Platform = "ios" | "android" | "desktop" | "otro";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Chrome|Chromium|Edg\//.test(ua)) return "desktop";
  return "otro";
}

export function usePlatform(): Platform | null {
  return useSyncExternalStore(
    () => () => undefined,
    detectPlatform,
    () => null,
  );
}
