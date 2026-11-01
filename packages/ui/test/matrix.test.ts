import { describe, expect, it } from "vitest";
import { LAYERS } from "@arch-mind/rules/model";
import { tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { CELL_SIZE, ROW_HEADER_WIDTH, buildMatrix, matrixWidth } from "../src/matrix.ts";

describe("matrix model (TST-013, AC-2)", () => {
  const matrix = buildMatrix(tst032Concepts);

  it("has a row and a column for each of the 13 concepts, in layer order", () => {
    expect(matrix.headers).toHaveLength(13);
    expect(matrix.cells).toHaveLength(13);
    expect(matrix.cells.every((row) => row.length === 13)).toBe(true);
    const layerIndexes = matrix.headers.map((h) => LAYERS.indexOf(h.layer));
    expect(layerIndexes).toEqual([...layerIndexes].sort((a, b) => a - b));
  });

  it("puts each of the 15 relations in its source-row, target-column cell with its type", () => {
    const index = (id: string) => matrix.headers.findIndex((h) => h.id === id);
    let found = 0;
    for (const c of tst032Concepts) {
      for (const r of c.relations) {
        expect(matrix.cells[index(c.id)]![index(r.to)]).toContainEqual(r);
        found++;
      }
    }
    expect(found).toBe(tst032RelationCount);
    expect(matrix.cells.flat(2)).toHaveLength(tst032RelationCount);
  });

  it("measures the table from its fixed row header and cell size", () => {
    expect(matrixWidth(13)).toBe(ROW_HEADER_WIDTH + 13 * CELL_SIZE);
    expect(matrixWidth(13)).toBeLessThan(1021);
  });
});
