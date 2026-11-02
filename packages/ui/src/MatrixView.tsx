import type { Concept } from "@arch-mind/rules/model";
import { useEffect, useMemo, useRef } from "react";
import { FitMessage } from "./FitMessage.tsx";
import type { OpenConcept } from "./LayerView.tsx";
import type { Neighbourhood } from "./neighbourhood.ts";
import { CELL_SIZE, ROW_HEADER_WIDTH, buildMatrix, matrixWidth } from "./matrix.ts";
import { cellProminence, type WireKind } from "./prominence.ts";
import { prefersReducedMotion } from "./camera.ts";
import { RelationPopover, useRelationPopover, type RelationTargetProps } from "./Popover.tsx";
import { wireAbbrev, wireCode, wireStyle, type WireCode } from "./wire-code.ts";

export function MatrixView({
  concepts,
  boardWidth,
  hood,
  wireType,
  onOpen,
}: {
  concepts: Concept[];
  boardWidth: number;
  hood: Neighbourhood | null;
  wireType: WireKind | null;
  onOpen: OpenConcept;
}) {
  const matrix = useMemo(() => buildMatrix(concepts), [concepts]);
  const container = useRef<HTMLDivElement>(null);
  const { open, targetProps } = useRelationPopover(container);
  const needed = matrixWidth(matrix.headers.length);

  // The matrix has no camera, so a new selection (a finder choice included) brings its row into view.
  useEffect(() => {
    const row = container.current?.querySelector('[aria-current="true"]')?.closest("tr");
    row?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "instant" : "smooth" });
  }, [hood?.id]);

  if (boardWidth > 0 && needed > boardWidth) return <FitMessage count={concepts.length} needed={needed} available={boardWidth} />;
  const near = hood ? new Set([hood.id, ...hood.connected]) : null;
  const headerState = (id: string) => (!hood || !near ? undefined : id === hood.id ? "selected" : near.has(id) ? "near" : "far");
  const label = (i: number) => `${matrix.headers[i]!.designator} ${matrix.headers[i]!.title}`;

  return (
    <div ref={container} className="relative w-fit border border-line bg-panel">
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
              <th key={h.id} scope="col" data-state={headerState(h.id)} className="h-40 border border-line p-0 align-bottom font-normal" title={h.title}>
                <span
                  className="block whitespace-nowrap px-1 py-1.5 text-left"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto" }}
                >
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: `var(--layer-${h.layer})` }}>
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
            <tr key={row.id} className="scroll-my-18">
              <th scope="row" data-state={headerState(row.id)} className="border border-line p-0 text-left font-normal">
                <button
                  type="button"
                  aria-current={hood?.id === row.id ? "true" : undefined}
                  className="press flex h-8 w-full items-center gap-2 bg-board px-2.5 text-left"
                  onClick={(e) => onOpen(row.id, e.currentTarget)}
                >
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: `var(--layer-${row.layer})` }}>
                    {row.designator}
                  </span>
                  <span className="truncate">{row.title}</span>
                </button>
              </th>
              {matrix.headers.map((col, c) => {
                const relations = matrix.cells[r]![c]!;
                return (
                  <td key={col.id} data-state={cellProminence(hood, wireType, row.id, col.id, relations)} className="h-8 border border-line p-0 text-center">
                    {relations.length > 0 && (
                      <RelationCell
                        label={`${relations.map((x) => x.type).join(", ")}: ${label(r)} to ${label(c)}`}
                        count={relations.length}
                        code={relations.length === 1 ? wireCode(relations[0]!.type) : null}
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

function RelationCell({ label, count, code, props }: { label: string; count: number; code: WireCode | null; props: RelationTargetProps }) {
  const { stroke, strokeDasharray } = wireStyle(code);
  return (
    <button type="button" data-relation-target aria-label={label} className="press flex h-8 w-full items-center justify-center" {...props}>
      <span
        className={`flex h-4 min-w-6 items-center justify-center px-0.5 text-[9px] font-semibold tabular-nums ${strokeDasharray ? "text-ink" : "text-board"}`}
        style={strokeDasharray ? { border: `1px dashed ${stroke}` } : { background: stroke }}
      >
        {count > 1 ? count : code ? wireAbbrev(code) : ""}
      </span>
    </button>
  );
}
