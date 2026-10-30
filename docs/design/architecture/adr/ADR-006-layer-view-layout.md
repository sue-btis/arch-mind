# ADR-006 — Layer view layout engine

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «ok elkjs and React Flow» (translated)
Related: FR-019, FR-020, FR-023, NFR-001, UX-001
Reversibility: two-way — layout is computed in one UI module; replacing the engine leaves data and other views untouched.

## Context
The layer view must stack client, network, server and data as bands and fit the reference screen's width (NFR-001). Views are dynamic filters, so positions cannot be placed by hand per view. Discovery's column layout was 1,954 px wide (`docs/discovery/findings.md` DQ-005).

## Decision Drivers
- Layers as stacked bands (FR-019, UX-001).
- Fits 1366 px width (NFR-001).
- Works for any filter without manual placement (FR-018).

## Options Considered
### Option A — elkjs layered layout, direction down, one partition per layer, orthogonal arrows
- Benefits: partitions force band order top to bottom; crossings minimized. Measured on 30 Oct 2026 with the discovery probe's 13 concepts and 15 relations (elkjs 0.9.3): 1,021 px wide, 866 px tall, bands client 12–254 px, network 324–566 px, server 636–774 px with no overlap, 0 crossing pairs (a proxy).
- Costs/risks: one sample; elkjs 0.12.1 is licensed EPL-2.0 OR GPL-3.0-or-later (npm registry, checked 30 Oct 2026); the current version 0.12.1 was not measured.

### Option B — dagre
- Costs/risks: no partition option found, so bands are not guaranteed (DQ-005, Hypothesis).

### Option C — Custom lane solver
- Benefits: full control of band shape.
- Costs/risks: building and tuning a layout algorithm.

### Option D — Hand placement per view
- Ruled out by: FR-018, views are any filter combination, so there is nothing fixed to place by hand.

### Rendering on top of the layout
The layout engine only computes positions; something must draw them. Raised by the author: «what difference would elkjs vs React Flow have?» (translated).
- Rendering R1 — Own SVG drawn from elkjs coordinates (what the discovery probe did). Benefits: full control, no extra dependency. Costs: hover, click, zoom and band drawing are written by hand.
- Rendering R2 — React Flow (@xyflow/react 12.12.0, MIT license per the npm registry, checked 30 Oct 2026) drawing nodes placed by elkjs. React Flow does no layout itself: its npm dependencies are zustand, classcat and @xyflow/system (d3 drag, zoom and selection), with no elkjs or dagre (npm registry, checked 30 Oct 2026); its "Elkjs Tree" and "Dagre Tree" pages are integration examples. Benefits: nodes are React components of the author's design; hover (FR-021) and click to detail (FR-024) are built-in events; layer bands as group or background nodes. Costs: one more dependency; default styles to override; free zoom must be fitted to the width so NFR-001 still holds.

## Decision
Option A (elkjs) for layout, with rendering R2 (React Flow). The matrix view (FR-022) is a plain table and needs no engine.

## Consequences
### Positive
- Width problem from discovery solved in the measured sample.

### Negative / Trade-offs
- Views taller than the screen need vertical scrolling (allowed by NFR-001).

## Verification / Revisit Trigger
- Milestone check: the TST-032 view at 1366 × 768 shows no horizontal scrollbar with the pinned elkjs version.
- Revisit if larger real views break the width or band order.
