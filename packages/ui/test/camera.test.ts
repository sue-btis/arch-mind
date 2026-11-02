import { describe, expect, it } from "vitest";
import { ZOOMS } from "../src/plates.ts";
import { MAX_ZOOM, frameBox, springStep, stepZoom, wheelZoom } from "../src/camera.ts";

describe("camera spring (AC-034)", () => {
  it("settles inside 600 ms and overshoots a move by less than 4 %", () => {
    let state = { value: 0, velocity: 0 };
    let peak = 0;
    let settledAt = Infinity;
    for (let ms = 1; ms <= 1000; ms++) {
      state = springStep(state.value, state.velocity, 100, 0.001);
      peak = Math.max(peak, state.value);
      if (Math.abs(100 - state.value) > 0.5) settledAt = Infinity;
      else if (settledAt === Infinity) settledAt = ms;
    }
    expect(peak).toBeLessThanOrEqual(104);
    expect(settledAt).toBeLessThanOrEqual(600);
  });
});

describe("continuous zoom (AC-034)", () => {
  it("never drops below Fit or passes three times Fit", () => {
    expect(wheelZoom(1, 500, 0)).toBe(1);
    expect(wheelZoom(2.9, -2000, 0)).toBe(MAX_ZOOM);
  });

  it("zooms in on a negative delta and out on a positive one, by line or by pixel", () => {
    expect(wheelZoom(1.5, -10, 0)).toBeGreaterThan(1.5);
    expect(wheelZoom(1.5, 10, 0)).toBeLessThan(1.5);
    expect(wheelZoom(1.5, -1, 1)).toBeGreaterThan(wheelZoom(1.5, -1, 0));
  });

  it("steps the buttons through the 1, 1.5, 2 and 3 times Fit stops from any continuous zoom", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1.7, 1)).toBe(2);
    expect(stepZoom(1.7, -1)).toBe(1.5);
    expect(stepZoom(3, 1)).toBe(3);
    expect(stepZoom(1.2, -1)).toBe(1);
    expect(ZOOMS).toEqual([1, 1.5, 2, 3]);
  });

  it("lands on Fit or the top stop when a Ctrl+wheel zoom ends within a thousandth of it", () => {
    expect(stepZoom(1.0005, -1)).toBe(1);
    expect(stepZoom(2.9995, 1)).toBe(MAX_ZOOM);
  });
});

describe("framing a neighbourhood (AC-030a)", () => {
  const free = { x0: 100, y0: 70, x1: 800, y1: 600 };

  it("centres the box in the free area at a zoom between Fit and twice Fit", () => {
    const box = { x0: 300, y0: 200, x1: 500, y1: 300 };
    const { zoom, origin } = frameBox(box, free, 1, box);
    expect(zoom).toBeGreaterThanOrEqual(1);
    expect(zoom).toBeLessThanOrEqual(2);
    const k = zoom;
    expect((400 - origin.x) * k).toBeCloseTo((free.x0 + free.x1) / 2, 5);
    expect((250 - origin.y) * k).toBeCloseTo((free.y0 + free.y1) / 2, 5);
  });

  it("keeps Fit when the box is larger than the free area, and keeps the selection inside it", () => {
    const selection = { x0: 100, y0: 20, x1: 200, y1: 80 };
    const { zoom, origin } = frameBox({ x0: 0, y0: 0, x1: 900, y1: 2000 }, free, 1, selection);
    expect(zoom).toBe(1);
    expect(selection.y0 - origin.y).toBeGreaterThanOrEqual(free.y0);
    expect(selection.y1 - origin.y).toBeLessThanOrEqual(free.y1);
  });
});
