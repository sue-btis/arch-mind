# ADR-010 — Grouped layer view layout

Status: Accepted
Date: 2026-11-01
Decision owners: author
Accepted by: author, 2026-11-01, «Nodos compuestos de elk» (verbatim, Spanish)
Related: FR-047, FR-048, FR-049, BR-009, NFR-001, FR-023, PD-029, PD-032, PD-033, ADR-008
Reversibility: two-way — layout only. Falling back to a graph of group nodes means rewriting the grouped layout in the UI layout module. Data, contracts and the ungrouped view stay as they are. Medium cost.

## Context
FR-048 adds a layer view grouped by domain. The author opens it from the would-not-fit message (FR-047, PD-032), so it exists for views that are too wide. Each plate shows one group per domain with its concept count, relations between groups appear as one labeled connection per pair with a count, and opening a group shows its concepts and their relations in place. A concept belongs to the group of its first listed domain (BR-009, PD-033).

Today the layer view is one elk layered graph partitioned by layer. elk computes every orthogonal route, and the UI only projects that plane onto the plates and draws drops and lanes in the gaps (ADR-008).

## Decision Drivers
- Groups live on their layer's plate and keep the plate order (FR-019, FR-048).
- A grouped view of a set the layer view refuses renders at Fit without horizontal scrolling (NFR-001 acceptance).
- Opening a group shows its concepts in place (FR-048). The author chose «Nodos compuestos de elk» so that the open group grows where it is.
- The existing projection, gap drops and invariants (no wire through a non-end concept, no shared lane, labels clear) stay valid (ADR-008).

## Options Considered
### Option A — Graph of group nodes
Before layout, each group becomes one node on its plate and relations between groups are merged into one edge with a count. The same partitioned elk graph lays it out. Opening a group replaces its node with its concepts, and elk lays the graph out again.
- Benefits: reuses the whole pipeline and its tested invariants unchanged; small graphs always fit.
- Costs/risks: opening a group re-places the rest of the map (animated, but it moves).
- Ruled out by: the author's choice, «Nodos compuestos de elk».

### Option B — elk compound nodes
Each group is a compound node holding its concepts. A closed group is a small node with no children laid out. An open group lays out its children inside it. Hierarchy handling lets elk route edges across group boundaries in the same layered, partitioned graph.
- Benefits: an open group grows in place; the closed and open states share one layout model.
- Costs/risks: compound nodes combined with layer partitioning, the plate band mapping and the gap drops have not been tried (Hypothesis). Edge routing across compound boundaries may break the "no wire through a non-end concept" and lane invariants. Fit may drop when a group opens.

## Decision
Option B: the grouped layer view lays out each domain group as an elk compound node on its layer's partition. Closed groups have no laid-out children. An open group lays out its concepts inside it. Connections follow the direction of the relations they stand for (FR-020): relations from group A to group B become one edge A → B, and relations from B to A a separate edge B → A. Every such edge carries the number of relations it stands for, plus their type when they all share one (FR-048). A relation between a concept in the open group and a closed group becomes one edge between that concept and the group, in its direction, counted the same way. Only one group is open at a time (FR-049). The UI projects the result through the same band-to-plate mapping as ADR-008.

## Consequences
### Positive
- Opening a group keeps the rest of the map in place as far as elk allows.
- One layout model for closed and open groups.

### Negative / Trade-offs
- The riskiest layout work of Phase 3: the milestone that builds the grouped view starts with a probe of compound nodes plus partitions plus projection on a refused fixture.
- The ADR-008 invariant tests must also run over grouped scenes.

## Verification / Revisit Trigger
- Probe at the start of the grouped-view milestone, over a fixture the layer view refuses. Two checks must hold: (1) every group closed, the grouped view renders at Fit ≥ 0.85 with no horizontal scrolling and the scene invariants of the ADR-008 addendum "One elk graph" hold; (2) for each group in turn, opened alone, either the view stays at Fit ≥ 0.85 with the invariants holding, or the group is reported as not fitting and stays closed (FR-049).
- Revisit and fall back to Option A if the probe fails either check, or if keeping the invariants requires a hand-written router (the ADR-008 addendum "One elk graph" removed it).

## Addendum — Open group and grouped-view floor (review RV-003, F-021)
Accepted by: author, 2026-11-01, «Uno abierto a la vez (Recommended)» (verbatim, Spanish; PD-035). Opening a group first closes the open one, and the grouped layout is computed with the requested group open. If its Fit scale would be below 0.85, the group stays closed and the FR-049 message is shown. A grouped view whose Fit scale is below 0.85 with every group closed is refused with the FR-023 message, which then offers focus and narrower filters only.

## Addendum — Fallback to Option A (M10 probe; revisit trigger)
Accepted by: author, 2026-11-02, «A. Grafo de grupos (Recommended)» (verbatim, Spanish). The M10 probe (`docs/changes/2026-11-02-M10-grouped-view/execution.md`) met this ADR's revisit trigger. With every group closed, both fixtures rendered at Fit 1.0 with every scene check passing. With a group opened alone, elk routed each wire of an inner concept around the compound border, about 33 plate units outside it. That put wires on the first and last plate edges (runs up to 100.9 px against the 35 px limit) and produced a 2.69 px stub, a shared line and parallels under 10 px. Keeping the invariants would have needed rewriting elk's routes, that is, a hand-written router.

The grouped layer view therefore uses Option A. Before layout, each closed group becomes one ordinary node on its layer's partition, and relations between groups merge into one edge per ordered pair. Opening a group replaces its node with its concepts, and the same flat, partitioned elk graph lays the view out again. The rest of the map re-places with the existing glide. Edge counts, shared-type labels, concept-to-closed-group edges, one open group at a time, the FR-049 rule and the projection all stay as in the Decision and the first addendum. Option B's in-place growth is given up.

## Addendum — Count from two relations up (M10 review F-5)
Accepted by: author, 2026-11-02, «Solo con 2 o más (Recommended)» (verbatim, Spanish; PRD PD-038). A connection that stands for two or more relations carries their number, plus their type when they all share one. A connection that stands for a single relation shows that relation's type alone, as the matrix does.
