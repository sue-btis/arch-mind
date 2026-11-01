import { LAYERS, type Concept, type Layer, type Relation } from "@arch-mind/rules/model";
import { designators } from "./layout.ts";

export const ROW_HEADER_WIDTH = 220;
export const CELL_SIZE = 32;

export interface MatrixHeader {
  id: string;
  designator: string;
  title: string;
  layer: Layer;
}

export interface Matrix {
  headers: MatrixHeader[];
  // cells[row][column] holds the relations from the row's concept to the column's concept.
  cells: Relation[][][];
}

export function buildMatrix(concepts: Concept[]): Matrix {
  const names = designators(concepts);
  const ordered = LAYERS.flatMap((layer) => concepts.filter((c) => c.layer === layer));
  const headers = ordered.map((c) => ({ id: c.id, designator: names.get(c.id)!, title: c.title, layer: c.layer }));
  const column = new Map(headers.map((h, i) => [h.id, i]));
  const cells = ordered.map((c) => {
    const row: Relation[][] = headers.map(() => []);
    for (const r of c.relations) row[column.get(r.to) ?? -1]?.push(r);
    return row;
  });
  return { headers, cells };
}

export function matrixWidth(count: number): number {
  return ROW_HEADER_WIDTH + count * CELL_SIZE;
}
