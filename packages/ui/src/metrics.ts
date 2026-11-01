// A plate point (u along the plate, v across it) lands on the screen at
// x = u - SHEAR * v, y = offset(plate) + SQUASH * v. Text and pictograms are never sheared: only their
// anchor points go through this projection.
export const SHEAR = 0.25;
export const SQUASH = 0.38;

export const LABEL_PX = 13;
export const PICTOGRAM_PX = 44;
const MIN_LABEL_PX = 11;
const MIN_PICTOGRAM_PX = 32;
export const FIT_FLOOR = Math.ceil(Math.max(MIN_LABEL_PX / LABEL_PX, MIN_PICTOGRAM_PX / PICTOGRAM_PX) * 100) / 100;

// The pictogram art stands on a ground point at (24, 40) of its 48-unit grid.
const ART_SCALE = PICTOGRAM_PX / 48;
export const GROUND = { x: 24 * ART_SCALE, y: 40 * ART_SCALE };
const PICTOGRAM_BELOW = PICTOGRAM_PX - GROUND.y;
export const LABEL_OFFSET = PICTOGRAM_BELOW + 3;
export const LINE_HEIGHT = 16;
export const LABEL_LINES = 2;
export const LABEL_CHARS = 18;
export const CHIP_CHARS = 16;
// Generous width of one 13 px character; only placement and bounds use it, the browser draws the text.
export const CHAR_PX = 7;
export const CHIP_PAD = { x: 4, y: 2 };

// Screen height of a concept: pictogram above its ground point, then a label of up to two lines.
export const OBJECT_HEIGHT = GROUND.y + LABEL_OFFSET + LABEL_LINES * LINE_HEIGHT;
// Where the ground point sits in the concept's cell, from the cell's top.
export const GROUND_FRACTION = GROUND.y / OBJECT_HEIGHT;

export function wrapText(text: string, budgets: number[], maxLines: number): string[] {
  const pieces = text
    .trim()
    .split(/\s+/)
    .flatMap((word, w) => word.split(/(?<=-)/).map((piece, p) => ({ piece, spaced: w > 0 && p === 0 })));
  const lines: string[] = [];
  const budget = (i: number) => budgets[Math.min(i, budgets.length - 1)]!;
  let current = "";
  for (const { piece, spaced } of pieces) {
    const joined = current === "" ? piece : `${current}${spaced ? " " : ""}${piece}`;
    if (current === "" || joined.length <= budget(lines.length)) {
      current = joined;
    } else {
      lines.push(current);
      current = piece;
    }
  }
  if (current !== "") lines.push(current);
  const kept = lines.slice(0, maxLines).map((line, i) => (line.length > budget(i) ? `${line.slice(0, budget(i) - 1)}…` : line));
  if (lines.length > maxLines) kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/…$/, "").slice(0, budget(maxLines - 1) - 1)}…`;
  return kept;
}

export function labelLines(designator: string, title: string): string[] {
  return wrapText(title, [LABEL_CHARS - designator.length - 1, LABEL_CHARS], LABEL_LINES);
}

export const textWidth = (line: string) => line.length * CHAR_PX;

export function chipLines(type: string): string[] {
  return wrapText(type, [CHIP_CHARS], 2);
}

export function chipSize(lines: string[]): { width: number; height: number } {
  return { width: Math.max(...lines.map(textWidth)) + 2 * CHIP_PAD.x, height: lines.length * LINE_HEIGHT + 2 * CHIP_PAD.y };
}
