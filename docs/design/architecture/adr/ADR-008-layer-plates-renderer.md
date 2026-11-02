# ADR-008 — Layer plates renderer

Status: Accepted
Date: 2026-11-01
Decision owners: author
Accepted by: author, 2026-11-01, «elkjs + own SVG (Recommended)»
Related: FR-019, FR-020, FR-021, FR-023, FR-024, FR-037 to FR-042, NFR-001, UX-001, UX-004, PD-021, PD-027
Reversibility: two-way — rendering only; the layout module, data and contracts stay, so a different renderer means rewriting one UI module. Medium cost.

## Context
PD-027 retires the flat layer view: layers become stacked plates with a pictogram per layer and per concept (PD-021, FR-019, FR-037, FR-038). Selecting a concept must bring its neighbourhood forward, zoom must return to a size that fits the screen width, and the view must stay usable by keyboard (FR-039, FR-041, FR-042, NFR-001). ADR-006 chose elkjs for layout and React Flow for drawing a flat view; React Flow draws flat nodes and edges and does not fit an isometric plate.

## Decision Drivers
- Plates stacked in the order client, network, server, data, in the author's own design (FR-019, UX-001).
- Pictograms, plates, wires and labels drawn together, with readable text (FR-037, FR-038, UX-004).
- Fit to the 1366 px reference width, zoom in and back to fit (NFR-001, FR-042).
- Selection, hover and keyboard focus on every concept and relation (FR-021, FR-039, FR-040, FR-041).
- Works for any filter without manual placement (FR-018).
- Accessibility baseline WCAG 2.2 AA (`PRODUCT.md` Accessibility & Inclusion).

## Options Considered
### Option A — elkjs computes each layer's 2D layout and orthogonal routes; the UI projects them isometrically and draws its own SVG
Plates, pictograms, wires and labels are SVG elements placed in screen space after projection. Zoom and Fit change the SVG viewBox. Selection, hover and focus attach to SVG elements. An accessible list of concepts and relations is offered for keyboard and screen readers.
- Benefits: no extra rendering dependency; text stays upright and unskewed; hit-testing happens in the coordinates the author sees; elkjs and its measurement (ADR-006) are kept.
- Costs/risks: zoom, hover, selection and focus are written by hand; the projected width of the TST-032 sample is not yet measured (ADR-006 measured 1,021 px for the flat layout); how cross-plate wires are routed after projection is verified in the plates milestone.

### Option B — React Flow with the flat graph tilted by CSS 3D transforms
- Benefits: keeps ADR-006's drawing library and its events.
- Costs/risks: hit-testing in flat coordinates breaks under transforms and text gets skewed (Hypothesis, not tested).
- Ruled out by: the author's choice, «elkjs + own SVG (Recommended)».

### Option C — A 3D engine (Three.js, WebGL)
- Benefits: true depth and a free camera.
- Costs/risks: heavy dependency; text and accessibility cost; oversized for 13 to 300 concepts.
- Ruled out by: the author's choice, «elkjs + own SVG (Recommended)».

## Decision
Option A. React Flow is removed from the Study UI. The pictogram artwork is a fixed library shipped with the app as a UI asset (ADR-009). The four layer pictograms are always part of it; a concept without a pictogram, or whose id is no longer in the library, is drawn with its layer's pictogram (FR-038, PD-026). The matrix view stays a plain table.

## Consequences
### Positive
- One drawing surface owned by the project; the view looks like arch-mind's own design (UX-001).
- Selection and the relation list share one source of truth, so choosing the other end of a listed relation selects that concept (FR-040).

### Negative / Trade-offs
- Interaction code that React Flow gave for free is now project code.
- ADR-007 still names React Flow as the drawing library of the layer view; this ADR replaces that detail and the rest of ADR-007 stands.

## Addendum — Fit scale and refusal floor (review RV-002, F-011)
Accepted by: author, 2026-11-01, «Shrink with a floor (Recommended)». This adds a measurable criterion for FR-023 and leaves the Decision unchanged; the numbers are under Verification and in the NFR-001 row of `quality-attributes.md`.

## Addendum — One elk graph (M05 Amendment 1; review RV-003, F-023)
Accepted by: author, 2026-11-01, «elk routes all (Recommended)» (recorded in `docs/changes/2026-11-01-M05-layer-plates/spec.md` Amendment 1). The per-layer layout described under Option A is replaced by one elk layered graph partitioned by layer. elk computes every orthogonal route, cross-layer ones included, and every edge label position. The UI only projects each layer's band onto its plate, and draws each wire that changes plates as straight drops plus one lane per wire in the gap between plates. No hand-written router remains. Scene invariants, checked over the full TST-032 scene and every layer subset:
- no wire crosses a concept or plate mark that is not one of its ends;
- no two wires share a lane;
- no wire crosses a concept label;
- labels sit nearest their own wire;
- wire ends sit on cell borders, with no stub under 8 px;
- parallel wires that overlap for more than 20 px are at least 10 px apart.

## Verification / Revisit Trigger
- Base sizes at scale 1: wire and connector labels 13 px, pictograms 44 px. Fit scale = min(1, available board width / projected width at scale 1). Readable means labels at least 11 px and pictograms at least 32 px on screen, so the floor is max(11 / 13, 32 / 44) = max(0.846, 0.727) = 0.85 (rounded up). When the Fit scale is below 0.85 the UI refuses to draw the view with the FR-023 message, which offers the FR-047 ways out.
- Milestone check: the 13-concept TST-032 view renders at Fit scale 0.85 or more at 1366 × 768 with no horizontal scrollbar (NFR-001).
- Keyboard test: every concept and relation can be selected and cleared without a pointer.
- Revisit if the projected layout is wider than the reference screen at fit size for real views, or if hand-written hit-testing proves unreliable.
