# ADR-007 — UI foundation: styling and components

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «I accept A (Recommended)» (translated)
Partially superseded by: ADR-008 (layer view drawing)
Related: CON-001, UX-001, UX-002, UX-003, NFR-001
Reversibility: two-way — components are copied into the repository and styled with utility classes; replacing them means restyling the Study UI, not touching data, contracts or servers.

## Context
ADR-004 fixed React with Vite for the Study UI but no styling approach or component set. The author chose Watermelon UI during `/impeccable init` («Yes, like that», translated; recorded in `PRODUCT.md` Stack). The review screen, filters, concept detail and problem list need ordinary app components; the layer view keeps its own design (UX-001) drawn by React Flow (ADR-006).

## Decision Drivers
- The author's choice of Watermelon UI (`PRODUCT.md` Stack, author, 2026-10-30).
- React with Vite and TypeScript (ADR-004).
- Accessibility baseline WCAG 2.2 AA (`PRODUCT.md` Accessibility & Inclusion).
- The layer view must not look like a generic diagram (UX-001).
- Facts verified on 2026-10-30: Watermelon UI is MIT (GitHub API, `WatermelonCorp/watermelon-platform`), installs components through the shadcn CLI from `https://registry.watermelon.sh/r/<component>.json`, requires React 18+ and Tailwind CSS v4, and lists Vite + React as its recommended setup (ui.watermelon.sh `/installation`, `/framework-support`).

## Options Considered
### Option A — Tailwind CSS v4 + shadcn CLI + Watermelon UI components
Components are copied into the repository by the shadcn CLI from Watermelon's registry and from shadcn/ui, then edited like project code.
- Benefits: the author's choice; components become project code the author owns and can restyle; animated components and blocks ready to adapt; works with the chosen stack.
- Costs/risks: Tailwind v4 becomes the styling foundation; copied components are not updated automatically; Watermelon's accessibility per component is not verified, so each copied component is checked against WCAG 2.2 AA when adopted.

### Option B — Tailwind CSS v4 + shadcn/ui only
- Benefits: the widely used base that Watermelon builds on; fewer sources.
- Costs/risks: fewer ready animated components; does not follow the author's choice.

### Option C — Plain CSS with project-written components
- Benefits: no styling dependency.
- Costs/risks: every control written and made accessible by hand.

### Option D — A packaged component library with its own styling system (for example MUI or Mantine)
- Benefits: large, documented component sets updated as a dependency.
- Costs/risks: the library's own look and theming system to override, which works against an own visual identity; not the author's choice.

## Decision
Option A for app components and styling. The layer view's nodes, bands and arrows remain project-designed React Flow components (ADR-006, UX-001); Watermelon components may be used around it (filters, panels), not as the diagram itself.

## Consequences
### Positive
- Components the author owns, in the stack already chosen.

### Negative / Trade-offs
- Each adopted component needs an accessibility check; copied code does not receive upstream fixes automatically.

## Verification / Revisit Trigger
- M01 and later UI milestones check each adopted component for keyboard use, visible focus and contrast.
- Revisit if Watermelon's registry stops being maintained or a needed component fails WCAG 2.2 AA and cannot be fixed locally.
