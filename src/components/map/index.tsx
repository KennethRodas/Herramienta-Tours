"use client";

// Public API of the map module. Pages import ONLY from "@/components/map".
// Each map loads maplibre-gl (client only) when its box nears the viewport;
// until then, and while the chunk loads, a sand placeholder holds the size.

import dynamic from "next/dynamic";
import { EditorSkeleton, FILL, LazyMount, MapSkeleton, shellClass } from "./lazy";
import type { MeetingPointMapProps, RouteEditorProps, RouteMapProps, TerrainMapProps } from "./types";

export type { MapPadding, MeetingPointMapProps, RouteEditorProps, RouteMapProps, TerrainMapProps } from "./types";

const TerrainMapImpl = dynamic(() => import("./terrain-map"), { ssr: false, loading: () => <MapSkeleton /> });
const RouteMapImpl = dynamic(() => import("./route-map"), { ssr: false, loading: () => <MapSkeleton /> });
const RouteMapFlyoverImpl = dynamic(() => import("./route-map"), { ssr: false, loading: () => <MapSkeleton profile /> });
const MeetingPointMapImpl = dynamic(() => import("./meeting-point-map"), { ssr: false, loading: () => <MapSkeleton /> });
const RouteEditorImpl = dynamic(() => import("./route-editor"), { ssr: false, loading: () => <EditorSkeleton /> });

/** Every route on a 3D relief of El Salvador; `focusTourId` flies to one. */
export function TerrainMap(props: TerrainMapProps) {
  const full = (props.variant ?? "full") === "full";
  return (
    <LazyMount className={shellClass("min-h-64 bg-sand-300", props.className)} placeholder={<MapSkeleton />} lenisPrevent={full}>
      <TerrainMapImpl {...props} className={FILL} />
    </LazyMount>
  );
}

/** One tour in 3D; with `flyover`, "Recorrer la ruta" and the elevation profile. */
export function RouteMap(props: RouteMapProps) {
  const Impl = props.flyover ? RouteMapFlyoverImpl : RouteMapImpl;
  return (
    <LazyMount
      className={shellClass(props.flyover ? "min-h-[480px] bg-sand-300" : "min-h-64 bg-sand-300", props.className)}
      placeholder={<MapSkeleton profile={props.flyover} />}
    >
      <Impl {...props} className={FILL} />
    </LazyMount>
  );
}

/** Flat street map of a meeting point with a link to Google Maps. */
export function MeetingPointMap(props: MeetingPointMapProps) {
  return (
    <LazyMount className={shellClass("min-h-64 bg-sand-300", props.className)} placeholder={<MapSkeleton />}>
      <MeetingPointMapImpl {...props} className={FILL} />
    </LazyMount>
  );
}

/** Wilber's route editor: trace, waypoints, undo, preview and save. */
export function RouteEditor(props: RouteEditorProps) {
  return (
    <LazyMount className={shellClass("min-h-[640px]", props.className)} placeholder={<EditorSkeleton />} lenisPrevent>
      <RouteEditorImpl {...props} className="" />
    </LazyMount>
  );
}
