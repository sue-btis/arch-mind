import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject, type SyntheticEvent } from "react";

export interface RelationInfo {
  type: string;
  from: string;
  to: string;
  source: string;
  explanation: string;
}

interface Open {
  key: string;
  relations: RelationInfo[];
  x: number;
  y: number;
  pinned: boolean;
}

export interface RelationTargetProps {
  onPointerEnter: (e: PointerEvent<Element>) => void;
  onPointerLeave: () => void;
  onFocus: (e: SyntheticEvent<Element>) => void;
  onBlur: () => void;
  onClick: (e: SyntheticEvent<Element>) => void;
}

// Hover and focus preview a relation; a click or tap pins it until Escape, a second tap or a click elsewhere.
export function useRelationPopover(container: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState<Open | null>(null);

  const targetProps = useCallback(
    (key: string, relations: RelationInfo[]): RelationTargetProps => {
      const place = (el: Element, pointer?: { x: number; y: number }) => {
        const box = container.current?.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: (pointer?.x ?? r.left + r.width / 2) - (box?.left ?? 0), y: (pointer?.y ?? r.bottom) - (box?.top ?? 0) };
      };
      const show = (el: Element, pointer?: { x: number; y: number }) => {
        const at = place(el, pointer);
        setOpen((prev) => (prev?.pinned ? prev : { key, relations, ...at, pinned: false }));
      };
      const toggle = (el: Element) => {
        const at = place(el);
        setOpen((prev) => {
          if (prev?.key === key) return prev.pinned ? null : { ...prev, pinned: true };
          return { key, relations, ...at, pinned: true };
        });
      };
      return {
        onPointerEnter: (e) => show(e.currentTarget, { x: e.clientX, y: e.clientY }),
        onPointerLeave: () => setOpen((prev) => (prev?.pinned ? prev : null)),
        onFocus: (e) => show(e.currentTarget),
        onBlur: () => setOpen((prev) => (prev?.pinned ? prev : null)),
        onClick: (e) => toggle(e.currentTarget),
      };
    },
    [container],
  );

  useEffect(() => {
    if (!open) return;
    // Captured so a pinned popover is the first layer an Escape closes; the app and the drawer skip a handled event.
    // A modal (the finder) owns its own Escape.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      if (open.pinned) e.preventDefault();
      setOpen(null);
    };
    const onDown = (e: globalThis.PointerEvent) => {
      if (open.pinned && !(e.target as Element).closest("[data-relation-target]")) setOpen(null);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return { open, targetProps };
}

export function RelationPopover({ open, container }: { open: Open | null; container: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);

  // Below the anchor by default; above it when the bottom of the window would cut the popover off.
  useLayoutEffect(() => {
    const el = ref.current;
    const box = container.current?.getBoundingClientRect();
    if (!open || !el || !box) return;
    const below = box.top + open.y + 14;
    const fitsBelow = below + el.offsetHeight <= window.innerHeight;
    const fitsAbove = box.top + open.y - 14 - el.offsetHeight >= 0;
    el.style.top = `${!fitsBelow && fitsAbove ? open.y - 14 - el.offsetHeight : open.y + 14}px`;
  }, [open, container]);

  if (!open) return null;
  const width = container.current?.clientWidth ?? 0;
  const left = Math.max(0, Math.min(open.x + 12, width - 336));
  return (
    <div
      ref={ref}
      role="tooltip"
      data-testid="relation-popover"
      className="popover-in pointer-events-none absolute z-20 w-80 rounded-xl border border-line bg-panel p-3 text-[13px] shadow-lg"
      style={{ left, top: open.y + 14 }}
    >
      {open.relations.map((r, i) => (
        <div key={i} className={i > 0 ? "mt-3 border-t border-line pt-3" : ""}>
          <p className="font-semibold">
            {r.type}: {r.from} → {r.to}
          </p>
          <p className="mt-1 text-ink-muted">
            <span className="font-medium text-ink">Source</span> {r.source}
          </p>
          <p className="mt-1">{r.explanation}</p>
        </div>
      ))}
    </div>
  );
}
