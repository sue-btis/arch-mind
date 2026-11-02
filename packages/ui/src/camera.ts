import type { Point } from "./layout.ts";
import { ZOOMS, revealBox, type Box } from "./plates.ts";

export interface Cam {
  k: number;
  x: number;
  y: number;
}

export const MAX_ZOOM = ZOOMS.at(-1)!;
// A selection never zooms in past this, so the neighbourhood stays in the context of its plates.
const FRAME_ZOOM = 2;
const FRAME_MARGIN = 32;
const WHEEL_RATE = 0.005;
const LINE_PX = 16;

// Damping ratio 0.85 overshoots a move by about 0.6 % and settles well inside 600 ms.
const OMEGA = 20;
const ZETA = 0.85;
// Below this distance in screen pixels the content is already where the eye reads it.
const SETTLED_PX = 0.2;
const SUBSTEP = 1 / 240;
const MAX_FRAME = 0.05;

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function springStep(value: number, velocity: number, target: number, seconds: number): { value: number; velocity: number } {
  let v = value;
  let vel = velocity;
  for (let left = seconds; left > 0; left -= SUBSTEP) {
    const dt = Math.min(SUBSTEP, left);
    vel += (OMEGA * OMEGA * (target - v) - 2 * ZETA * OMEGA * vel) * dt;
    v += vel * dt;
  }
  return { value: v, velocity: vel };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// The next stop of the zoom buttons above or below the current continuous zoom.
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const eps = 1e-3;
  const next = direction > 0 ? ZOOMS.find((z) => z > zoom + eps) : [...ZOOMS].reverse().find((z) => z < zoom - eps);
  return next ?? (direction > 0 ? MAX_ZOOM : 1);
}

export function wheelZoom(zoom: number, deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * LINE_PX : deltaY;
  return clamp(zoom * Math.exp(-pixels * WHEEL_RATE), 1, MAX_ZOOM);
}

// Zooms and centres a box in the free area; zoom never drops below Fit, so a box taller than the free area at Fit
// cannot be shown whole and `must` (the selection) is kept inside the free area instead.
export function frameBox(box: Box, free: Box, fitK: number, must: Box): { zoom: number; origin: Point } {
  const width = Math.max(1, box.x1 - box.x0);
  const height = Math.max(1, box.y1 - box.y0);
  const fits = Math.min((free.x1 - free.x0 - 2 * FRAME_MARGIN) / width, (free.y1 - free.y0 - 2 * FRAME_MARGIN) / height);
  const zoom = clamp(fits / fitK, 1, FRAME_ZOOM);
  const k = fitK * zoom;
  const centred = { x: (box.x0 + box.x1) / 2 - (free.x0 + free.x1) / (2 * k), y: (box.y0 + box.y1) / 2 - (free.y0 + free.y1) / (2 * k) };
  return { zoom, origin: revealBox(centred, k, free, must) };
}

// The camera the viewBox describes is always the target; the glide only animates the content from where the user last saw it.
export function createGlide(render: (visual: Cam, target: Cam) => void) {
  let visual: Cam | null = null;
  let target: Cam = { k: 1, x: 0, y: 0 };
  const velocity = { k: 0, x: 0, y: 0 };
  let frame = 0;
  let last = 0;

  const settled = () =>
    Math.abs(target.k - visual!.k) < 1e-4 && Math.abs(target.x - visual!.x) * target.k < SETTLED_PX && Math.abs(target.y - visual!.y) * target.k < SETTLED_PX && Math.abs(velocity.x) * target.k < SETTLED_PX && Math.abs(velocity.y) * target.k < SETTLED_PX;

  const tick = (now: number) => {
    const seconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    for (const channel of ["k", "x", "y"] as const) {
      const next = springStep(visual![channel], velocity[channel], target[channel], seconds);
      visual![channel] = next.value;
      velocity[channel] = next.velocity;
    }
    if (settled()) {
      visual = { ...target };
      velocity.k = velocity.x = velocity.y = 0;
      frame = 0;
    } else {
      frame = requestAnimationFrame(tick);
    }
    render(visual!, target);
  };

  return {
    to(next: Cam, instant: boolean) {
      target = { ...next };
      if (!visual || instant || prefersReducedMotion()) {
        cancelAnimationFrame(frame);
        frame = 0;
        visual = { ...next };
        velocity.k = velocity.x = velocity.y = 0;
        render(visual, target);
      } else if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    // Scene units per second, so a released drag keeps sliding from the speed it was let go at.
    kick(vx: number, vy: number) {
      if (!prefersReducedMotion()) {
        velocity.x = vx;
        velocity.y = vy;
      }
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
