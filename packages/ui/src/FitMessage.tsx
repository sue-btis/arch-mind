const NARROW = "Select fewer layers, domains or concerns to narrow the view.";

// The matrix cannot shrink, so it reports a width; the plates shrink down to a floor, so they report a scale.
export function FitMessage(props: { count: number; available: number } & ({ needed: number } | { scale: number; floor: number })) {
  const board = Math.round(props.available);
  return (
    <p role="status" data-testid="fit-message" className="max-w-md rounded-xl border border-line bg-panel p-4 text-[13px]">
      {"needed" in props
        ? `${props.count} concepts need ${Math.round(props.needed)} px at natural size, but the board is ${board} px wide. ${NARROW}`
        : `${props.count} concepts would shrink to ${Math.round(props.scale * 100)} % to fit the ${board} px board, below the ${Math.round(props.floor * 100)} % that keeps labels and pictograms readable. ${NARROW}`}
    </p>
  );
}
