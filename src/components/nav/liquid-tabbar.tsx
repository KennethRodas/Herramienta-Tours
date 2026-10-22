"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { applyGlass, SWITCHER_GLASS, type GlassConfig, type GlassHandle } from "./liquid-glass";

// iOS 26-style tab bar with a liquid-glass lens you can press and drag between
// tabs. Port of the user-supplied "Liquid Glass Navbar | Switcher" (MIT).
// Works as navigation (href) or as a segmented control (onSelect).

export interface LiquidTab {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  /** Small count bubble (e.g. pending conflicts). */
  badge?: number;
}

interface Props {
  tabs: LiquidTab[];
  activeId: string;
  onSelect?: (id: string) => void;
  /** "bar": floating bottom tab bar with icons. "segmented": compact text switcher. */
  variant?: "bar" | "segmented";
  className?: string;
  ariaLabel?: string;
  glass?: Partial<GlassConfig>;
}

const DRAG_THRESHOLD = 6;
const OVERSHOOT = 22;

export function LiquidTabBar({ tabs, activeId, onSelect, variant = "bar", className, ariaLabel = "Navegación", glass }: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const glassRef = useRef<GlassHandle | null>(null);
  const live = useRef({
    active: Math.max(0, tabs.findIndex((t) => t.id === activeId)),
    target: 0,
    pointerId: null as number | null,
    pressX: 0,
    pressY: 0,
    drag: false,
    pressWidth: 0,
    finishTimer: 0,
    rebuildQueued: false,
  });

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));

  const metrics = useCallback((i: number) => {
    const nav = navRef.current!;
    const item = itemRefs.current[i];
    if (!item) return { left: 0, width: 0, center: 0 };
    const nr = nav.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    const sx = nr.width > 0 ? nav.clientWidth / nr.width : 1;
    const left = (ir.left - nr.left) * sx;
    const width = ir.width * sx;
    return { left, width, center: left + width / 2 };
  }, []);

  const setIndicator = useCallback((left: number, width: number, animate: boolean) => {
    const el = indicatorRef.current;
    if (!el) return;
    if (!animate) {
      const prev = el.style.transition;
      el.style.transition = "none";
      el.style.left = `${left}px`;
      el.style.width = `${width}px`;
      void el.offsetWidth;
      el.style.transition = prev;
      return;
    }
    el.style.left = `${left}px`;
    el.style.width = `${width}px`;
  }, []);

  const snapTo = useCallback(
    (i: number, animate: boolean) => {
      const m = metrics(i);
      setIndicator(m.left, m.width, animate);
    },
    [metrics, setIndicator],
  );

  // Follow the route / external state.
  useLayoutEffect(() => {
    live.current.active = activeIndex;
    if (live.current.pointerId === null) snapTo(activeIndex, true);
  }, [activeIndex, snapTo]);

  useEffect(() => {
    snapTo(live.current.active, false);
    const onResize = () => snapTo(live.current.active, false);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      glassRef.current?.destroy();
    };
  }, [snapTo]);

  const queueRebuild = () => {
    if (live.current.rebuildQueued) return;
    live.current.rebuildQueued = true;
    requestAnimationFrame(() => {
      live.current.rebuildQueued = false;
      glassRef.current?.rebuild();
    });
  };

  const setGlow = (clientX: number, clientY: number, alpha: number) => {
    const nav = navRef.current;
    if (!nav) return;
    const nr = nav.getBoundingClientRect();
    nav.style.setProperty("--gx", `${clientX - nr.left}px`);
    nav.style.setProperty("--gy", `${clientY - nr.top}px`);
    nav.style.setProperty("--ga", String(alpha));
  };

  const nearest = (localX: number) => {
    let best = 0;
    let bestD = Infinity;
    tabs.forEach((_, i) => {
      const d = Math.abs(localX - metrics(i).center);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const select = (i: number) => {
    const tab = tabs[i];
    if (!tab) return;
    onSelect?.(tab.id);
    if (tab.href) router.push(tab.href);
  };

  const begin = (clientX: number, clientY: number) => {
    window.clearTimeout(live.current.finishTimer);
    indicatorRef.current?.classList.add("is-pressing");
    wrapRef.current?.classList.add("is-engaged");
    setGlow(clientX, clientY, 0.24);
    if (!glassRef.current && indicatorRef.current) {
      glassRef.current = applyGlass(indicatorRef.current, () => ({ ...SWITCHER_GLASS, ...glass, balancedSpecular: true }));
    }
    queueRebuild();
  };

  const end = () => {
    window.clearTimeout(live.current.finishTimer);
    live.current.finishTimer = window.setTimeout(() => {
      indicatorRef.current?.classList.remove("is-pressing");
      navRef.current?.classList.remove("is-dragging");
      wrapRef.current?.classList.remove("is-engaged");
      navRef.current?.style.setProperty("--ga", "0");
      glassRef.current?.destroy();
      glassRef.current = null;
    }, 500);
  };

  const onMove = (e: PointerEvent) => {
    const st = live.current;
    if (e.pointerId !== st.pointerId) return;
    const dx = Math.abs(e.clientX - st.pressX);
    const dy = Math.abs(e.clientY - st.pressY);
    if (!st.drag && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
      st.drag = true;
      navRef.current?.classList.add("is-dragging");
    }
    if (st.drag) {
      setGlow(e.clientX, e.clientY, 0.18);
      const nav = navRef.current!;
      const nr = nav.getBoundingClientRect();
      const localX = e.clientX - nr.left;
      const w = st.pressWidth || metrics(st.active).width;
      const left = Math.min(Math.max(localX - w / 2, -OVERSHOOT), nav.clientWidth - w + OVERSHOOT);
      const el = indicatorRef.current!;
      el.style.left = `${left}px`;
      el.style.width = `${w}px`;
      st.target = nearest(localX);
      queueRebuild();
    } else {
      setGlow(e.clientX, e.clientY, 0.22);
    }
  };

  const clearListeners = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
  };

  function onUp(e: PointerEvent) {
    const st = live.current;
    if (e.pointerId !== st.pointerId) return;
    clearListeners();
    navRef.current?.classList.remove("is-dragging");
    st.active = st.target;
    snapTo(st.target, true);
    queueRebuild();
    window.setTimeout(queueRebuild, 120);
    end();
    st.pointerId = null;
    st.drag = false;
    select(st.target);
  }

  function onCancel(e: PointerEvent) {
    const st = live.current;
    if (e.pointerId !== st.pointerId) return;
    clearListeners();
    navRef.current?.classList.remove("is-dragging");
    snapTo(st.active, true);
    end();
    st.pointerId = null;
    st.drag = false;
  }

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    const st = live.current;
    if (st.pointerId !== null) return;
    e.preventDefault();
    st.pointerId = e.pointerId;
    st.drag = false;
    st.target = i;
    st.pressX = e.clientX;
    st.pressY = e.clientY;
    st.pressWidth = metrics(i).width;
    begin(e.clientX, e.clientY);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      itemRefs.current[next]?.focus();
    }
  };

  const segmented = variant === "segmented";

  return (
    <div ref={wrapRef} className={cn("lg-wrap", segmented ? "lg-segmented" : "lg-bar", className)}>
      <div
        ref={navRef}
        role={segmented ? "radiogroup" : undefined}
        aria-label={ariaLabel}
        className="lg-inner"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        <div className="lg-glow" aria-hidden />
        <div ref={indicatorRef} className="lg-indicator" data-radius="999" aria-hidden />
        {tabs.map((tab, i) => {
          const active = i === activeIndex;
          const common = {
            ref: (el: HTMLElement | null) => {
              itemRefs.current[i] = el;
            },
            className: cn("lg-item", active && "is-active"),
            onPointerDown: onPointerDown(i),
            onKeyDown: onKeyDown(i),
            style: { touchAction: "none" as const },
          };
          const content = (
            <>
              {tab.icon && !segmented && <span className="lg-icon">{tab.icon}</span>}
              <span className="lg-label">{tab.label}</span>
              {tab.badge ? <span className="lg-badge tabular">{tab.badge}</span> : null}
            </>
          );
          if (tab.href) {
            return (
              <a
                key={tab.id}
                href={tab.href}
                {...common}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  // Keyboard activation (detail === 0); pointer selection happens on pointerup.
                  if (e.detail === 0) select(i);
                }}
              >
                {content}
              </a>
            );
          }
          return (
            <button
              key={tab.id}
              type="button"
              role={segmented ? "radio" : undefined}
              aria-checked={segmented ? active : undefined}
              {...common}
              onClick={(e) => {
                if (e.detail === 0) select(i);
              }}
            >
              {content}
            </button>
          );
        })}
      </div>
      <style>{LIQUID_CSS}</style>
    </div>
  );
}

const LIQUID_CSS = `
.lg-wrap { position: relative; transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1); }
.lg-wrap.is-engaged { transform: scale(1.03); }
.lg-inner {
  position: relative; z-index: 1; display: grid; align-items: center; gap: 4px;
  border-radius: 999px; --gx: 50%; --gy: 50%; --ga: 0;
  background: rgb(var(--lg-tint, 244 238 227) / 0.68);
  -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6); /* taste-skill-ignore: user-supplied liquid-glass tab bar, a fixed overlay */
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7), inset 0 0 0 1px rgb(6 43 138 / 0.08), 0 14px 36px rgb(4 32 110 / 0.18); /* taste-skill-ignore: user-supplied liquid-glass tab bar, a fixed overlay */
}
.field-ink .lg-inner, [data-theme="noche"] .lg-inner { --lg-tint: 4 32 110; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 0 0 1px rgb(238 230 214 / 0.10), 0 18px 40px rgb(2 20 71 / 0.4); } /* taste-skill-ignore: user-supplied liquid-glass tab bar, a fixed overlay */
.lg-glow { position: absolute; inset: 0; border-radius: 999px; clip-path: inset(0 round 999px); pointer-events: none; z-index: 0;
  background: radial-gradient(240px 150px at var(--gx) var(--gy), rgb(255 255 255 / var(--ga)) 0%, rgb(255 255 255 / 0) 74%); transition: background 180ms ease; } /* taste-skill-ignore: user-supplied liquid-glass tab bar, a fixed overlay */
.lg-indicator { position: absolute; left: 0; border-radius: 999px; z-index: 6; pointer-events: none; transform-origin: center;
  will-change: left, width, transform; background: rgb(6 43 138 / 0.10);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.9), inset 0 0 0 1px rgb(6 43 138 / 0.08); /* taste-skill-ignore: user-supplied liquid-glass tab bar, a fixed overlay */
  transition: left 240ms cubic-bezier(0.2, 0.9, 0.22, 1), width 240ms cubic-bezier(0.2, 0.9, 0.22, 1), transform 250ms ease, background-color 250ms ease; }
.field-ink .lg-indicator, [data-theme="noche"] .lg-indicator { background: rgb(238 230 214 / 0.16); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 0 0 1px rgb(238 230 214 / 0.12); } /* taste-skill-ignore: user-supplied liquid-glass tab bar, a fixed overlay */
.lg-indicator.is-pressing { z-index: 30; transform: scale(1.5); background: rgb(255 255 255 / 0.10); }
.lg-inner.is-dragging .lg-indicator { transition: transform 200ms ease, background-color 200ms ease; }
.lg-item { position: relative; z-index: 2; border: 0; outline: none; cursor: pointer; border-radius: 999px; background: transparent;
  display: inline-flex; align-items: center; justify-content: center; flex-direction: column; gap: 2px; min-width: 0;
  color: var(--cobalt-600); font-family: var(--font-sans); font-weight: 600; letter-spacing: 0.005em; text-decoration: none;
  transition: color 200ms ease; user-select: none; -webkit-user-select: none; }
.field-ink .lg-item, [data-theme="noche"] .lg-item { color: var(--cobalt-300); }
.lg-item:hover, .lg-item.is-active { color: var(--cobalt-800); }
.field-ink .lg-item:hover, .field-ink .lg-item.is-active, [data-theme="noche"] .lg-item:hover, [data-theme="noche"] .lg-item.is-active { color: var(--sand-50); }
.lg-item:focus-visible { outline: 2px solid var(--ring); outline-offset: -4px; }
.lg-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.lg-badge { position: absolute; top: 6px; right: 18%; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: var(--stamp); color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
.lg-bar .lg-inner { height: 68px; padding: 6px 8px; }
.lg-bar .lg-indicator { top: 6px; height: 56px; }
.lg-bar .lg-item { height: 56px; font-size: 12px; }
.lg-bar .lg-icon { display: grid; place-items: center; width: 26px; height: 26px; }
.lg-bar .lg-icon svg { width: 24px; height: 24px; }
.lg-segmented .lg-inner { height: 52px; padding: 5px; }
.lg-segmented .lg-indicator { top: 5px; height: 42px; }
.lg-segmented .lg-item { height: 42px; font-size: 16px; padding: 0 14px; flex-direction: row; gap: 6px; }
@media (prefers-reduced-motion: reduce) { .lg-indicator.is-pressing { transform: none; } .lg-wrap.is-engaged { transform: none; } }
`;
