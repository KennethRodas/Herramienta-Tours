"use client";

import { motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { CommandPalette } from "@/components/motion/command-palette";
import { normalizeCode } from "@/lib/domain/availability";
import { useConflicts } from "@/lib/sim/hooks";
import { useCommandItems } from "./command";
import { DashContext, useDash, type DashApi, type Overlay } from "./context";
import { useEffectiveTheme, useIndex, useSession } from "./hooks";
import { captureInstallPrompt } from "./install";
import { LiveIsland } from "./live-island";
import { MobileHeader, MobileTabBar, MoreSheet, Sidebar, TopBar, titleFor } from "./nav";
import { OverlayHost } from "./overlay-host";

// Wilber's "Campamento base": PIN gate, day/night ink, navigation (Liquid Glass
// tab bar on the phone, sidebar on the desktop), ⌘K, live events and the one
// sheet every record opens in.

// Night tokens live unlayered in globals.css ([data-theme="noche"]); the shell only
// flips the attribute. Toasts come from the root Toaster, rounded here for the panel.
const SHELL_CSS = `
html, body { overscroll-behavior: none; }
[data-sonner-toast][data-styled="true"] { border-radius: var(--radius-field) !important; }
[data-sonner-toast][data-styled="true"] [data-description] { color: var(--cobalt-200) !important; }
[data-sonner-toast][data-styled="true"] [data-button] { border-radius: 9999px !important; height: 30px !important; padding: 0 14px !important; font-size: 14px !important; font-weight: 600 !important; background: var(--sand-50) !important; color: var(--cobalt-800) !important; }
[data-theme="noche"] [data-sonner-toast][data-styled="true"] { background: var(--sand-100) !important; color: var(--cobalt-800) !important; }
[data-theme="noche"] [data-sonner-toast][data-styled="true"] [data-description] { color: var(--cobalt-600) !important; }
[data-theme="noche"] [data-sonner-toast][data-styled="true"] [data-button] { background: var(--cobalt-800) !important; color: var(--sand-50) !important; }
.lg-wrap.dash-seg .lg-inner { background: var(--paper); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: none; } /* taste-skill-ignore: in-page switchers sit flat, only the tab bar floats */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 260ms; animation-timing-function: cubic-bezier(0.23, 1, 0.32, 1); }
`;

type TransitionDoc = Document & { startViewTransition?: (update: () => void) => unknown };

function useApplyTheme(theme: "dia" | "noche" | undefined, pathname: string) {
  const applied = useRef(false);
  useLayoutEffect(() => {
    if (!theme) return;
    const html = document.documentElement;
    const apply = () => {
      if (theme === "noche") html.setAttribute("data-theme", "noche");
      else html.removeAttribute("data-theme");
      // Status bar and browser chrome follow the ground colour.
      const ground = getComputedStyle(html).getPropertyValue("--ground").trim();
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        if (m.dataset.wilberPrev === undefined) m.dataset.wilberPrev = m.content;
        if (ground) m.content = ground;
      });
    };
    const changing = (html.getAttribute("data-theme") === "noche") !== (theme === "noche");
    const first = !applied.current;
    applied.current = true;
    const doc = document as TransitionDoc;
    // Day to night cross-fades the whole page once; first paint and reduced motion switch instantly.
    if (changing && !first && typeof doc.startViewTransition === "function" && document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doc.startViewTransition(apply);
    } else {
      apply();
    }
  }, [theme, pathname]);

  useEffect(
    () => () => {
      document.documentElement.removeAttribute("data-theme");
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        if (m.dataset.wilberPrev !== undefined) {
          m.content = m.dataset.wilberPrev;
          delete m.dataset.wilberPrev;
        }
      });
    },
    [],
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ground" aria-busy="true">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.3 }}>
        <LogoMark className="size-16" />
      </motion.div>
    </div>
  );
}

export function WilberShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const theme = useEffectiveTheme();
  const gate = pathname === "/wilber/entrar";
  useApplyTheme(theme, pathname);
  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (session === false && !gate) router.replace(`/wilber/entrar?volver=${encodeURIComponent(pathname)}`);
  }, [session, gate, pathname, router]);

  return (
    <>
      <style>{SHELL_CSS}</style>
      {session === undefined || (session === false && !gate) ? <Splash /> : gate ? children : <Frame>{children}</Frame>}
    </>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [stack, setStack] = useState<Overlay[]>([]);
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const conflicts = useConflicts();

  const open = useCallback((o: Overlay) => setStack([o]), []);
  const push = useCallback((o: Overlay) => setStack((s) => [...s, o]), []);
  const replace = useCallback((o: Overlay) => setStack((s) => (s.length ? [...s.slice(0, -1), o] : [o])), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const openPalette = useCallback(() => setPalette(true), []);
  const api = useMemo<DashApi>(() => ({ stack, open, push, replace, back, close, openPalette }), [stack, open, push, replace, back, close, openPalette]);

  const title = titleFor(pathname);
  const count = conflicts?.length ?? 0;

  return (
    <DashContext.Provider value={api}>
      <div className="min-h-dvh bg-ground text-ink lg:flex">
        <Sidebar conflicts={count} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={title} onSearch={openPalette} island={<LiveIsland />} />
          <MobileHeader title={title} onSearch={openPalette} />
          <main className="flex-1 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+116px)] sm:px-6 lg:px-10 lg:pt-3 lg:pb-16">{children}</main>
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+6px)] z-[70] flex justify-center lg:hidden">
        <LiveIsland />
      </div>
      <MobileTabBar conflicts={count} moreOpen={more} onMore={() => setMore(true)} />
      <MoreSheet open={more} onOpenChange={setMore} />
      <Palette open={palette} onOpenChange={setPalette} />
      <OverlayHost />
      <Suspense fallback={null}>
        <DeepLinks />
      </Suspense>
    </DashContext.Provider>
  );
}

function Palette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useCommandItems();
  return (
    <CommandPalette
      items={items}
      open={open}
      onOpenChange={onOpenChange}
      placeholder="Código, nombre, WhatsApp o salida (SA24)"
      emptyMessage="Sin resultados. Probá con el código WIL-…, el nombre o la referencia SA24."
    />
  );
}

/** ?salida=<id> and ?reserva=<código> open their sheet from any panel page. */
function DeepLinks() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const idx = useIndex();
  const { open } = useDash();
  const handled = useRef<string | null>(null);
  const salida = params.get("salida");
  const reserva = params.get("reserva");
  const key = salida ? `s:${salida}` : reserva ? `r:${reserva}` : null;

  useEffect(() => {
    if (!key) {
      handled.current = null;
      return;
    }
    if (!idx || handled.current === key) return;
    handled.current = key;
    if (salida) {
      if (idx.departureById.has(salida)) open({ kind: "departure", id: salida });
      else toast.error("Esa salida ya no existe.");
    } else if (reserva) {
      const code = normalizeCode(reserva);
      const b = idx.bookingById.get(reserva) ?? idx.s.bookings.find((x) => x.code === code);
      if (b) open({ kind: "booking", id: b.id });
      else toast.error(`No hay una reserva ${code}.`);
    }
    const rest = new URLSearchParams(params.toString());
    rest.delete("salida");
    rest.delete("reserva");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [key, idx, salida, reserva, open, params, pathname, router]);

  return null;
}
