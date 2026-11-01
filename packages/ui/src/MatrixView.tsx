import type { Concept } from "@arch-mind/rules/model";
import { useMemo, useRef } from "react";
import { FitMessage } from "./FitMessage.tsx";
import type { OpenConcept } from "./LayerView.tsx";
import { CELL_SIZE, ROW_HEADER_WIDTH, buildMatrix, matrixWidth } from "./matrix.ts";
import { RelationPopover, useRelationPopover, type RelationTargetProps } from "./Popover.tsx";

export function MatrixView({ concepts, boardWidth, onOpen }: { concepts: Concept[]; boardWidth: number; onOpen: OpenConcept }) {
  const matrix = useMemo(() => buildMatrix(concepts), [concepts]);
  const container = useRef<HTMLDivElement>(null);
  const { open, targetProps } = useRelationPopover(container);
  const needed = matrixWidth(matrix.headers.length);

  if (boardWidth > 0 && needed > boardWidth) return <FitMessage count={concepts.length} needed={needed} available={boardWidth} />;
  const label = (i: number) => `${matrix.headers[i]!.designator} ${matrix.headers[i]!.title}`;

  return (
    <div ref={container} className="relative">
      <table className="border-collapse text-[13px]" style={{ tableLayout: "fixed", width: needed }}>
        <caption className="sr-only">Relations from the row concept to the column concept</caption>
        <colgroup>
          <col style={{ width: ROW_HEADER_WIDTH }} />
          {matrix.headers.map((h) => (
            <col key={h.id} style={{ width: CELL_SIZE }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td />
            {matrix.headers.map((h) => (
              <th key={h.id} scope="col" className="h-40 border border-line p-0 align-bottom font-normal" title={h.title}>
                <span
                  className="block whitespace-nowrap px-1 py-1.5 text-left"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto" }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: `var(--layer-${h.layer})` }}>
                    {h.designator}
                  </span>{" "}
                  {h.title}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.headers.map((row, r) => (
            <tr key={row.id}>
              <th scope="row" className="border border-line p-0 text-left font-normal">
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 bg-board px-2.5 text-left"
                  style={{ borderLeft: `3px solid var(--layer-${row.layer})` }}
                  onClick={(e) => onOpen(row.id, e.currentTarget)}
                >
                  <span className="text-[11px] font-semibold" style={{ color: `var(--layer-${row.layer})` }}>
                    {row.designator}
                  </span>
                  <span className="truncate">{row.title}</span>
                </button>
              </th>
              {matrix.headers.map((col, c) => {
                const relations = matrix.cells[r]![c]!;
                return (
                  <td key={col.id} className="h-8 border border-line p-0 text-center">
                    {relations.length > 0 && (
                      <RelationCell
                        label={`${relations.map((x) => x.type).join(", ")}: ${label(r)} to ${label(c)}`}
                        count={relations.length}
                        props={targetProps(
                          `${row.id}>${col.id}`,
                          relations.map((x) => ({ type: x.type, from: label(r), to: label(c), source: x.source, explanation: x.explanation })),
                        )}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <RelationPopover open={open} container={container} />
    </div>
  );
}

function RelationCell({ label, count, props }: { label: string; count: number; props: RelationTargetProps }) {
  return (
    <button type="button" data-relation-target aria-label={label} className="flex h-8 w-full items-center justify-center" {...props}>
      <span className="flex h-3 min-w-3 items-center justify-center bg-[var(--wire)] px-0.5 text-[9px] font-semibold text-board">
        {count > 1 ? count : ""}
      </span>
    </button>
  );
}
