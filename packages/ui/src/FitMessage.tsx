const NARROW = "Select fewer layers, domains or concerns to narrow the view.";
const ACTION = "press rounded-lg border border-line px-3 py-1 text-[13px] font-medium hover:bg-canvas";

// The matrix cannot shrink, so it reports a width; the plates shrink down to a floor, so they report a scale.
// Neither choice is taken for the author: the buttons only start it.
export function FitMessage(
  props: { count: number; available: number; onNarrow: () => void; onFocusConcept: () => void } & ({ needed: number } | { scale: number; floor: number }),
) {
  const board = Math.round(props.available);
  return (
    <div data-testid="fit-message" className="flex max-w-md flex-col gap-3 rounded-xl border border-line bg-panel p-4 text-[13px]">
      <p role="status">
        {"needed" in props
          ? `${props.count} concepts need ${Math.round(props.needed)} px at natural size, but the board is ${board} px wide. ${NARROW}`
          : `${props.count} concepts would shrink to ${Math.round(props.scale * 100)} % to fit the ${board} px board, below the ${Math.round(props.floor * 100)} % that keeps labels and pictograms readable. ${NARROW}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={ACTION} onClick={props.onNarrow}>
          Narrow the filters
        </button>
        <button type="button" className={ACTION} onClick={props.onFocusConcept}>
          Focus on a concept
        </button>
      </div>
    </div>
  );
}
