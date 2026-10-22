import type { Map as MLMap } from "maplibre-gl";
import { along, bearing, clamp, easeInOut, turn, type LL, type Line } from "./geo";

// "Recorrer la ruta": a follow camera that rides the route at a constant ground
// speed. One frame loop does three jobs:
// - playback: the position advances at baseSpeed × rate metres per second;
// - scrubbing: the position glides to the requested distance (critically damped);
// - entry: the first second blends from the current view into the follow view.
// The heading looks ahead along the route and is smoothed in time, so corners
// turn gently; the camera height follows the ground, smoothed the same way.

export type FlyoverState = "idle" | "playing" | "paused" | "ended";

export interface FollowView {
  zoom: number;
  pitch: number;
}

interface Cam {
  center: LL;
  zoom: number;
  pitch: number;
  bearing: number;
}

const ENTRY_S = 1.1;
const HEADING_TAU = 0.8;
const SEEK_TAU = 0.14;
const GROUND_TAU = 0.35;

/** Fixed ground speed for a route: long trails 40 s, short ones never under 14 s. */
export function baseSpeedFor(length: number) {
  const seconds = clamp(length / 90, 14, 40);
  return length / seconds;
}

export class Flyover {
  readonly line: Line;
  readonly baseSpeed: number;
  state: FlyoverState = "idle";
  rate = 1;

  private map: MLMap;
  private view: FollowView;
  private onFrame: (d: number) => void;
  private onState: (state: FlyoverState) => void;
  private raf = 0;
  private last = 0;
  private d = 0;
  private target = 0;
  private mode: "rest" | "play" | "seek" = "rest";
  private engaged = false;
  private blend = 1;
  private from: Cam | null = null;
  private heading: number | null = null;
  private turning = false;
  private ground: number | null = null;

  constructor(map: MLMap, line: Line, view: FollowView, onFrame: (d: number) => void, onState: (state: FlyoverState) => void) {
    this.map = map;
    this.line = line;
    this.view = view;
    this.onFrame = onFrame;
    this.onState = onState;
    this.baseSpeed = baseSpeedFor(line.length);
  }

  get position() {
    return this.d;
  }

  /** True while the camera is driven by the route. */
  get following() {
    return this.engaged;
  }

  /** Zoom and tilt of the follow camera (2D flies flat). */
  setView(view: FollowView) {
    this.view = view;
    if (this.engaged && !this.raf) {
      this.apply(0);
      this.onFrame(this.d);
    }
  }

  play() {
    if (this.line.length <= 0) return;
    if (this.d >= this.line.length - 0.5) {
      this.d = 0;
      this.target = 0;
      this.heading = null;
    }
    this.engage(false);
    this.mode = "play";
    this.setState("playing");
    this.kick();
  }

  pause() {
    if (this.mode === "play") this.mode = "rest";
    if (this.state === "playing") this.setState("paused");
  }

  /** Puts the follow camera at `d`. `instant` jumps without gliding (reduced motion). */
  seek(d: number, instant = false) {
    this.target = clamp(d, 0, this.line.length);
    if (this.mode === "play") {
      this.mode = "rest";
      this.setState("paused");
    } else if (this.state === "idle" || this.state === "ended") {
      this.setState("paused");
    }
    this.engage(instant);
    if (instant) {
      this.d = this.target;
      this.heading = null;
      this.ground = null;
      this.blend = 1;
      this.apply(0);
      this.onFrame(this.d);
      return;
    }
    this.mode = "seek";
    this.kick();
  }

  /** The visitor took the map: stop driving the camera, keep the position. */
  release() {
    this.stopLoop();
    this.mode = "rest";
    this.engaged = false;
    if (this.state === "playing") this.setState("paused");
  }

  /** Back to the start, camera released. */
  reset() {
    this.release();
    this.d = 0;
    this.target = 0;
    this.heading = null;
    this.setState("idle");
  }

  destroy() {
    this.stopLoop();
  }

  private setState(state: FlyoverState) {
    if (this.state === state) return;
    this.state = state;
    this.onState(state);
  }

  private engage(instant: boolean) {
    if (this.engaged) return;
    this.engaged = true;
    this.heading = null;
    this.ground = null;
    if (instant) {
      this.blend = 1;
      this.from = null;
      return;
    }
    const c = this.map.getCenter();
    this.from = { center: [c.lng, c.lat], zoom: this.map.getZoom(), pitch: this.map.getPitch(), bearing: this.map.getBearing() };
    this.blend = 0;
  }

  private kick() {
    if (this.raf) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 1 / 60;
    this.last = now;
    const length = this.line.length;

    if (this.mode === "play") {
      this.d = Math.min(length, this.d + this.baseSpeed * this.rate * dt);
      this.target = this.d;
      if (this.d >= length) {
        this.mode = "rest";
        this.setState("ended");
      }
    } else if (this.mode === "seek") {
      this.d += (this.target - this.d) * (1 - Math.exp(-dt / SEEK_TAU));
      if (Math.abs(this.target - this.d) < 0.5) {
        this.d = this.target;
        this.mode = "rest";
      }
    }
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / ENTRY_S);

    this.apply(dt);
    this.onFrame(this.d);

    if (this.engaged && (this.mode !== "rest" || this.blend < 1 || this.turning)) {
      this.raf = requestAnimationFrame(this.frame);
    } else {
      this.last = 0;
    }
  };

  private apply(dt: number) {
    const length = this.line.length;
    const ahead = clamp(length * 0.07, 40, 420);
    const back = along(this.line, Math.max(0, this.d - ahead * 0.5));
    const look = along(this.line, Math.min(length, this.d + ahead));
    const same = back[0] === look[0] && back[1] === look[1];
    const wanted = same ? (this.heading ?? this.map.getBearing()) : bearing(back, look);

    if (this.heading === null || dt === 0) {
      this.heading = wanted;
      this.turning = false;
    } else {
      const delta = turn(this.heading, wanted);
      this.heading = (this.heading + delta * (1 - Math.exp(-dt / HEADING_TAU)) + 360) % 360;
      this.turning = Math.abs(delta) > 0.4;
    }

    const center = along(this.line, Math.min(length, this.d + ahead * 0.35));
    const ground = this.map.queryTerrainElevation(center);
    if (ground !== null && Number.isFinite(ground)) {
      this.ground = this.ground === null || dt === 0 ? ground : this.ground + (ground - this.ground) * (1 - Math.exp(-dt / GROUND_TAU));
    }

    let cam: Cam = { center, zoom: this.view.zoom, pitch: this.view.pitch, bearing: this.heading };
    const entering = this.blend < 1 && this.from;
    if (entering && this.from) cam = mix(this.from, cam, easeInOut(this.blend));
    this.map.jumpTo(
      {
        center: cam.center,
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: cam.bearing,
        ...(!entering && this.ground !== null ? { elevation: this.ground } : {}),
      },
      { flyover: true },
    );
  }
}

function mix(a: Cam, b: Cam, t: number): Cam {
  return {
    center: [a.center[0] + (b.center[0] - a.center[0]) * t, a.center[1] + (b.center[1] - a.center[1]) * t],
    zoom: a.zoom + (b.zoom - a.zoom) * t,
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    bearing: a.bearing + turn(a.bearing, b.bearing) * t,
  };
}
