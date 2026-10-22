"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react";
import { formatKm, formatMeters } from "@/lib/domain/format";
import { capturePointer, releasePointer } from "@/lib/touch";
import { cn } from "@/lib/utils";
import { clamp, niceStep, ticks } from "./geo";
import { KIND_LABEL, KIND_PRIORITY } from "./markers";
import { elevationAt, type ProfileData } from "./profile";

// Elevation profile, printed in the two inks: a cobalt line over a 12 % cobalt
// screen, axes in metres and kilometres, waypoints as dots with their names.
// The cursor moves imperatively (no React render per frame) so it can follow
// the flyover at 60 fps; dragging on it scrubs the route.

export interface ProfileHandle {
  /** Position of the walker, metres from the start; null hides it. */
  setCursor: (d: number | null) => void;
}

export type ScrubPhase = "start" | "move" | "end";

interface Props {
  data: ProfileData;
  ref?: Ref<ProfileHandle>;
  onScrub?: (d: number, phase: ScrubPhase) => void;
  onHover?: (d: number | null) => void;
  height?: number;
  stats?: boolean;
  className?: string;
}

const PAD = { l: 58, r: 16, t: 26, b: 24 };
const LABEL_CHAR = 7.2;

function km(d: number) {
  return formatKm(d / 1000);
}

function geometry(data: ProfileData, width: number, height: number) {
  const plotW = width - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  if (plotW < 40 || plotH < 20 || data.d.length < 2 || data.length <= 0) return null;

  const range = Math.max(data.max - data.min, 20);
  const step = niceStep(range, 3);
  let lo = Math.floor(data.min / step) * step;
  let hi = Math.ceil(data.max / step) * step;
  if (hi - lo < step) hi = lo + step;
  if (lo < 0 && data.min >= 0) lo = 0;
  const x = (d: number) => PAD.l + (d / data.length) * plotW;
  const y = (e: number) => PAD.t + (1 - (e - lo) / (hi - lo)) * plotH;
  const base = PAD.t + plotH;

  let line = "";
  data.d.forEach((d, i) => {
    line += `${i ? "L" : "M"}${x(d).toFixed(1)} ${y(data.e[i]).toFixed(1)}`;
  });
  const area = `${line}L${x(data.length).toFixed(1)} ${base}L${PAD.l} ${base}Z`;

  // Gridlines on the same round step as the range, thinned to three or fewer.
  const yTicks: number[] = [];
  const every = Math.ceil(((hi - lo) / step + 1) / 3);
  for (let v = lo, i = 0; v <= hi + step * 1e-6; v += step, i++) if (i % every === 0) yTicks.push(+v.toFixed(3));
  const kmLength = data.length / 1000;
  const kmStep = niceStep(kmLength, plotW < 320 ? 3 : 5);
  const xTicks = ticks(0, kmLength, plotW < 320 ? 3 : 5).filter((v) => v <= kmLength + kmStep * 0.01);

  // Waypoint names: the summit first, then the rest, skipping any that would
  // touch a name already placed.
  const placed: [number, number][] = [];
  const order = [...data.waypoints].sort((a, b) => KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]);
  const shown = new Set<string>();
  for (const w of order) {
    const cx = x(w.d);
    const textW = w.name.length * LABEL_CHAR;
    const left = cx - textW / 2 < 2 ? cx : cx + textW / 2 > width - 2 ? cx - textW : cx - textW / 2;
    if (placed.some(([a, b]) => left < b + 8 && left + textW > a - 8)) continue;
    placed.push([left, left + textW]);
    shown.add(w.id);
  }
  const marks = data.waypoints.map((w) => {
    const cx = x(w.d);
    const textW = w.name.length * LABEL_CHAR;
    const anchor: "start" | "middle" | "end" = cx - textW / 2 < 2 ? "start" : cx + textW / 2 > width - 2 ? "end" : "middle";
    return { ...w, cx, cy: y(elevationAt(data, w.d)), anchor, show: shown.has(w.id) };
  });

  return { x, y, base, line, area, yTicks, xTicks, marks, plotW };
}

export function ElevationProfile({ data, ref, onScrub, onHover, height = 120, stats = true, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  const [width, setWidth] = useState(0);
  const clipId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geom = useMemo(() => geometry(data, width, height), [data, width, height]);

  const draw = () => {
    const g = cursorRef.current;
    const dot = dotRef.current;
    const clip = clipRef.current;
    const readout = readoutRef.current;
    const wrap = wrapRef.current;
    if (!g || !dot || !clip || !readout || !wrap || !geom) return;
    const active = activeRef.current;
    const shown = hoverRef.current ?? active;
    clip.setAttribute("width", active === null ? "0" : String(Math.max(0, geom.x(active) - PAD.l)));
    if (shown === null) {
      g.style.opacity = "0";
      readout.style.opacity = "0";
      return;
    }
    const cx = geom.x(shown);
    const e = elevationAt(data, shown);
    g.setAttribute("transform", `translate(${cx.toFixed(1)} 0)`);
    dot.setAttribute("cy", geom.y(e).toFixed(1));
    g.style.opacity = "1";
    readout.textContent = `${km(shown)} · ${formatMeters(Math.round(e))}`;
    const rw = readout.offsetWidth;
    readout.style.transform = `translateX(${clamp(cx - rw / 2, 0, Math.max(0, width - rw)).toFixed(1)}px)`;
    readout.style.opacity = "1";
    if (active !== null) {
      wrap.setAttribute("aria-valuenow", String(Math.round(active)));
      wrap.setAttribute("aria-valuetext", `${km(active)}, ${formatMeters(Math.round(elevationAt(data, active)))}`);
    }
  };

  useImperativeHandle(ref, () => ({
    setCursor(d) {
      activeRef.current = d === null ? null : clamp(d, 0, data.length);
      draw();
    },
  }));

  // Geometry changed (resize, new samples): put the cursor back where it was.
  useEffect(() => {
    draw();
  });

  const distanceAt = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || !geom) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left - PAD.l) / geom.plotW, 0, 1) * data.length;
  };

  const interactive = Boolean(onScrub);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0 || !geom) return;
    capturePointer(e.currentTarget, e.pointerId);
    scrubbingRef.current = true;
    hoverRef.current = null;
    const d = distanceAt(e.clientX);
    activeRef.current = d;
    draw();
    onScrub?.(d, "start");
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!geom) return;
    const d = distanceAt(e.clientX);
    if (scrubbingRef.current) {
      activeRef.current = d;
      draw();
      onScrub?.(d, "move");
    } else if (e.pointerType === "mouse") {
      hoverRef.current = d;
      draw();
      onHover?.(d);
    }
  };
  const endScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    releasePointer(e.currentTarget, e.pointerId);
    onScrub?.(activeRef.current ?? 0, "end");
  };
  const onPointerLeave = () => {
    if (scrubbingRef.current || hoverRef.current === null) return;
    hoverRef.current = null;
    draw();
    onHover?.(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const L = data.length;
    const current = activeRef.current ?? 0;
    const small = L * (e.shiftKey ? 0.1 : 0.02);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = current + small;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = current - small;
    else if (e.key === "PageUp") next = current + L * 0.1;
    else if (e.key === "PageDown") next = current - L * 0.1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = L;
    if (next === null) return;
    e.preventDefault();
    activeRef.current = clamp(next, 0, L);
    draw();
    onScrub?.(activeRef.current, "end");
  };

  const approximate = data.source === "waypoints";

  return (
    <figure className={cn("flex flex-col gap-1.5", className)}>
      {stats ? (
        <figcaption>
          <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-small">
            {[
              ["Distancia", km(data.length)],
              ["Subida", `+${formatMeters(Math.round(data.gain))}`],
              ["Bajada", `−${formatMeters(Math.round(data.loss))}`],
              ["Máxima", formatMeters(Math.round(data.max))],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="text-[17px] font-semibold leading-none tabular">{value}</dd>
              </div>
            ))}
            {approximate ? <div className="text-ink-soft">Perfil aproximado por puntos</div> : null}
          </dl>
        </figcaption>
      ) : null}
      <div
        ref={wrapRef}
        className={cn("relative w-full select-none [-webkit-touch-callout:none]", interactive && "cursor-ew-resize touch-pan-y")}
        style={{ height }}
        role={interactive ? "slider" : "img"}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? "Posición en la ruta" : `Perfil de elevación: ${km(data.length)}, subida ${formatMeters(Math.round(data.gain))}`}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? Math.round(data.length) : undefined}
        aria-valuenow={interactive ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        {geom ? (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden>
            <defs>
              <clipPath id={clipId}>
                <rect ref={clipRef} x={PAD.l} y={0} width={0} height={height} />
              </clipPath>
            </defs>
            {geom.yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={PAD.l} x2={width - PAD.r} y1={geom.y(v)} y2={geom.y(v)} stroke="var(--cobalt-800)" strokeOpacity={0.12} />
                <text
                  x={PAD.l - 8}
                  y={geom.y(v)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={13}
                  fill="var(--cobalt-600)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatMeters(v)}
                </text>
              </g>
            ))}
            <path d={geom.area} fill="var(--cobalt-800)" fillOpacity={0.12} />
            <path d={geom.area} fill="var(--cobalt-800)" fillOpacity={0.22} clipPath={`url(#${CSS.escape(clipId)})`} />
            <path d={geom.line} fill="none" stroke="var(--cobalt-800)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <line x1={PAD.l} x2={width - PAD.r} y1={geom.base} y2={geom.base} stroke="var(--cobalt-800)" strokeOpacity={0.4} />
            {geom.xTicks.map((v, i) => (
              <text
                key={`x${v}`}
                x={geom.x(v * 1000)}
                y={height - 5}
                textAnchor={i === 0 ? "start" : "middle"}
                fontSize={13}
                fill="var(--cobalt-600)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {i === geom.xTicks.length - 1 ? `${v.toLocaleString("es-SV", { maximumFractionDigits: 1 })} km` : v.toLocaleString("es-SV", { maximumFractionDigits: 1 })}
              </text>
            ))}
            {geom.marks.map((m) => (
              <g key={m.id}>
                {m.show ? (
                  <line x1={m.cx} x2={m.cx} y1={17} y2={Math.max(17, m.cy - 6)} stroke="var(--cobalt-800)" strokeOpacity={0.22} />
                ) : null}
                <circle cx={m.cx} cy={m.cy} r={4} fill="var(--cobalt-800)" stroke="var(--sand-50)" strokeWidth={2} />
                {m.show ? (
                  <text x={m.cx} y={13} textAnchor={m.anchor} fontSize={13} fontWeight={600} fill="var(--cobalt-800)">
                    {m.name}
                    <title>{`${m.name} · ${KIND_LABEL[m.kind]}`}</title>
                  </text>
                ) : null}
              </g>
            ))}
            <g ref={cursorRef} style={{ opacity: 0 }}>
              <line x1={0} x2={0} y1={PAD.t - 6} y2={geom.base} stroke="var(--cobalt-800)" strokeWidth={1.5} />
              <circle ref={dotRef} cx={0} cy={geom.base} r={5.5} fill="var(--cobalt-800)" stroke="var(--sand-50)" strokeWidth={2.5} />
            </g>
          </svg>
        ) : null}
        <div
          ref={readoutRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bg-cobalt-800 px-1.5 py-0.5 text-[13px] font-semibold leading-tight text-sand-50 tabular opacity-0"
        />
      </div>
      <table className="sr-only">
        <caption>Puntos de la ruta</caption>
        <tbody>
          {data.waypoints.map((w) => (
            <tr key={w.id}>
              <th scope="row">{w.name}</th>
              <td>{km(w.d)}</td>
              <td>{formatMeters(Math.round(w.altitude ?? elevationAt(data, w.d)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
