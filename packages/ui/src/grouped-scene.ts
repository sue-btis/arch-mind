import type { GroupedLayout, PlateGroup } from "./grouped-layout.ts";
import { LAYERS } from "@arch-mind/rules/model";
import { SHEAR } from "./metrics.ts";
import { projectScene, union, type Scene } from "./plates.ts";
import type { Point } from "./layout.ts";

export interface SceneGroup extends Pick<PlateGroup, "id" | "layer" | "domain" | "count" | "open"> {
  corners: Point[];
}

export interface GroupedScene extends Scene {
  groups: SceneGroup[];
}

// Same band-to-plate projection, gap drops and lanes as the flat scene; groups are projected through it as shears of their cell rectangles.
export function buildGroupedScene(layout: GroupedLayout, shear = SHEAR): GroupedScene {
  const { scene, onPlate } = projectScene(layout, shear);
  const groups = layout.groups.map((g): SceneGroup => {
    const at = onPlate(LAYERS.indexOf(g.layer));
    const corners = [
      { x: g.x, y: g.y },
      { x: g.x + g.width, y: g.y },
      { x: g.x + g.width, y: g.y + g.height },
      { x: g.x, y: g.y + g.height },
    ].map(at);
    return { id: g.id, layer: g.layer, domain: g.domain, count: g.count, open: g.open, corners };
  });
  const bounds = union([scene.bounds, ...groups.flatMap((g) => g.corners.map((c) => ({ x0: c.x, y0: c.y, x1: c.x, y1: c.y })))]);
  return { ...scene, groups, bounds, width: bounds.x1 - bounds.x0, height: bounds.y1 - bounds.y0 };
}
