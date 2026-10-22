import type { Map as MLMap } from "maplibre-gl";
import type { LL } from "./geo";

// A small label pass for the HTML tickets: in priority order, a ticket that
// would cover one already placed folds down to its dot (hover or focus opens
// it again). Runs at most once per frame while the camera moves.

export interface LabelItem {
  /** The maplibre marker element (gets data-collapsed). */
  el: HTMLElement;
  lngLat: LL;
  /** Higher wins. */
  priority: number;
}

const GAP = 4;

/** Sets data-* flags on a marker element (hidden, active…) without touching React state. */
export function flagMarker(el: HTMLElement, flags: Record<string, boolean>) {
  for (const [name, on] of Object.entries(flags)) {
    const value = on ? "true" : "false";
    if (el.dataset[name] !== value) el.dataset[name] = value;
  }
}

export function placeLabels(map: MLMap, items: LabelItem[]) {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const sorted = [...items].sort((a, b) => b.priority - a.priority);

  for (const item of sorted) {
    if (item.el.dataset.hidden === "true") continue;
    const ticket = item.el.querySelector<HTMLElement>(".wm-ticket");
    if (!ticket) continue;
    const p = map.project(item.lngLat);
    // Off screen: nothing to collide with.
    if (p.x < -200 || p.y < -200 || p.x > width + 200 || p.y > height + 200) continue;
    const w = ticket.offsetWidth;
    const h = ticket.offsetHeight;
    // The ticket sits on a 7px stem above a 10px dot centred on the point.
    const box = { x0: p.x - w / 2 - GAP, x1: p.x + w / 2 + GAP, y0: p.y - 12 - h - GAP, y1: p.y + 6 + GAP };
    const hit = placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
    if (!hit) placed.push(box);
    const next = hit ? "true" : "false";
    if (item.el.dataset.collapsed !== next) item.el.dataset.collapsed = next;
  }
}
