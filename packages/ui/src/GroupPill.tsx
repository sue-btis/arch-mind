// Same slot as the focus pill: the two never show together, because focus takes over the board while it lasts.
const LEFT_CLEAR = 372;
const RIGHT_CLEAR = 264;

export function GroupPill({ sheet, onExit }: { sheet: number; onExit: () => void }) {
  return (
    <div className="pointer-events-none absolute top-4 z-10 flex justify-center" style={{ left: LEFT_CLEAR, right: sheet + RIGHT_CLEAR }}>
      <div data-testid="group-pill" className="island pill-in pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl py-1.5 pl-4 pr-1.5 text-[13px]">
        <p className="whitespace-nowrap">
          Grouped by domain<span aria-hidden="true"> · </span>
        </p>
        <button type="button" onClick={onExit} className="press flex shrink-0 items-center gap-1.5 rounded-[10px] bg-accent px-2.5 py-1 font-medium text-on-accent">
          Exit
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
