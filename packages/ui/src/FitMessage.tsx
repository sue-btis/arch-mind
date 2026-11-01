export function FitMessage({ count, needed, available }: { count: number; needed: number; available: number }) {
  return (
    <p role="status" data-testid="fit-message" className="m-4 rounded-xl border border-line bg-panel p-4 text-[13px]">
      {count} concepts need {Math.round(needed)} px at natural size, but the board is {Math.round(available)} px wide. Select fewer
      layers, domains or concerns to narrow the view.
    </p>
  );
}
