"use client";

import { useMemo } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import type { MeetingPoint, Tour } from "@/lib/domain/types";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ElevationProfile } from "./elevation-profile";
import { toLine, type LL } from "./geo";
import { profileFromWaypoints } from "./profile";
import { SV_BOUNDS } from "./style";

// Without WebGL2 there is no map: the route is drawn over the tour photo as a
// plain polyline, and the elevation profile (from the waypoints) stays.

export const NO_WEBGL = "Este navegador no muestra mapas 3D: abrí la página en Chrome, Edge, Firefox o Safari actualizado.";

function projector(points: LL[], w: number, h: number, pad: number) {
  const lat0 = points.reduce((s, p) => s + p[1], 0) / Math.max(points.length, 1);
  const k = Math.cos((lat0 * Math.PI) / 180);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of points) {
    minX = Math.min(minX, lng * k);
    maxX = Math.max(maxX, lng * k);
    minY = Math.min(minY, -lat);
    maxY = Math.max(maxY, -lat);
  }
  const s = Math.min((w - 2 * pad) / Math.max(maxX - minX, 1e-9), (h - 2 * pad) / Math.max(maxY - minY, 1e-9));
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxY - minY) * s) / 2;
  return ([lng, lat]: LL): [number, number] => [ox + (lng * k - minX) * s, oy + (-lat - minY) * s];
}

function Notice({ className }: { className?: string }) {
  return <p className={cn("paper max-w-md px-3 py-2 text-small", className)}>{NO_WEBGL}</p>;
}

export function RouteFallback({ tour, showProfile, className }: { tour: Tour; showProfile: boolean; className?: string }) {
  const photo = PHOTO_CREDITS[tour.photo];
  const line = useMemo(() => toLine(tour.route.path), [tour.route.path]);
  const data = useMemo(() => profileFromWaypoints(line, tour.route.waypoints), [line, tour.route.waypoints]);
  const project = projector(tour.route.path.length ? tour.route.path : [tour.route.camera.center], 100, 100, 14);
  const points = tour.route.path.map((p) => project(p).join(",")).join(" ");

  return (
    <div className={cn("flex flex-col bg-sand-300", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {photo ? (
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
        ) : null}
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full" role="img" aria-label={`Trazo de ${tour.name}`}>
          <polyline points={points} fill="none" stroke="var(--sand-50)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <polyline points={points} fill="none" stroke="var(--cobalt-800)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {tour.route.waypoints.map((w) => {
            const [x, y] = project([w.lng, w.lat]);
            return <circle key={w.id} cx={x} cy={y} r={1.6} fill="var(--cobalt-800)" stroke="var(--sand-50)" strokeWidth={0.8} />;
          })}
        </svg>
        <Notice className="absolute left-3 top-3 mr-3" />
        {photo ? (
          <p className="absolute bottom-2 right-2 bg-sand-50/90 px-2 py-0.5 text-[13px] text-ink-soft">
            Foto: {photo.author} · {photo.licence}
          </p>
        ) : null}
      </div>
      {showProfile ? (
        <div className="paper px-4 pb-2 pt-3">
          <ElevationProfile data={data} />
        </div>
      ) : null}
    </div>
  );
}

export function TerrainFallback({
  tours,
  focusTourId,
  onSelectTour,
  className,
}: {
  tours: Tour[];
  focusTourId?: string;
  onSelectTour?: (id: string) => void;
  className?: string;
}) {
  const project = projector([SV_BOUNDS[0], SV_BOUNDS[1]], 1000, 560, 30);
  return (
    <div className={cn("relative overflow-hidden bg-sand-200", className)}>
      <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full">
        {tours.map((t) => {
          const at = t.route.path[0] ?? t.route.camera.center;
          const [x, y] = project(at);
          const on = t.id === focusTourId;
          return (
            <g
              key={t.id}
              role="button"
              tabIndex={0}
              aria-label={t.name}
              aria-pressed={on}
              className="cursor-pointer outline-none"
              onClick={() => onSelectTour?.(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectTour?.(t.id);
                }
              }}
            >
              <circle cx={x} cy={y} r={on ? 9 : 6} fill="var(--cobalt-800)" stroke="var(--sand-50)" strokeWidth={3} />
              <text x={x + 12} y={y + 5} fontSize={18} fontWeight={on ? 700 : 600} fill="var(--cobalt-800)" paintOrder="stroke" stroke="var(--sand-200)" strokeWidth={4}>
                {t.shortName}
              </text>
            </g>
          );
        })}
      </svg>
      <Notice className="absolute left-3 top-3 mr-3" />
    </div>
  );
}

export function MeetingFallback({ point, className }: { point: MeetingPoint; className?: string }) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 bg-sand-300 p-4", className)}>
      <div>
        <p className="font-display text-lead font-semibold">{point.name}</p>
        <p className="text-small text-ink-soft">
          {point.address}, {point.city}
        </p>
      </div>
      <a href={point.mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "h-10 self-start px-4 text-[15px]")}>
        Abrir en Google Maps
        <ExternalLink size={16} aria-hidden />
      </a>
    </div>
  );
}

export function EditorFallback({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center bg-sand-300 p-6", className)}>
      <p className="max-w-sm text-center text-body">El editor de rutas necesita WebGL2: abrilo en Chrome, Edge, Firefox o Safari actualizado.</p>
    </div>
  );
}
