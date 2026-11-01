# ADR-009 — Pictogram and illustration storage

Status: Accepted
Date: 2026-11-01
Decision owners: author
Accepted by: author, 2026-11-01, «Field + SVG file (Recommended)»
Related: FR-025, FR-034 to FR-038, NFR-003, NFR-004, BR-008, UX-004, PD-022, PD-024, PD-025, PD-026
Reversibility: one-way — it is a data format; changing it means migrating every concept that has a pictogram or an illustration.

## Context
Phase 2 gives a concept an optional pictogram from a fixed library and an optional visual illustration of its SEE-I illustration part (PD-022). ADR-002 fixed the concept format: Markdown with YAML frontmatter and the SEE-I under four headings. This ADR extends it and does not change its decision. The illustration is SVG that Claude generates at capture, so the app treats it as untrusted input (PD-025).

## Decision Drivers
- A concept is complete and readable as text without pictogram or illustration (NFR-004, FR-014).
- A capture saves everything or leaves the store unchanged (NFR-003).
- At most one pictogram and one illustration per concept (BR-008).
- Illustrations come from Claude and must not run code in the browser.
- Plain Markdown viewers should still show the illustration. Evidence: Markdown image links render in common viewers.

## Options Considered
### Option A — Optional frontmatter field `pictogram`; the illustration is a separate file `illustrations/<id>.svg` in the store's concept folder, linked from the Illustration part as a Markdown image
- Benefits: the `.md` stays readable text; viewers show the image; the SVG can be validated and served as a file.
- Costs/risks: two files per illustrated concept, so a save has two writes (see Write order).

### Option B — SVG inline in the `.md`
- Costs/risks: unreadable in a text editor.
- Ruled out by: NFR-004.

## Decision
Option A.
- `pictogram` holds the id of a library pictogram. Library membership is checked by the rules module, not the data schema. The library is a fixed set of isometric pictograms: the artwork ships with the app as a UI asset (ADR-008), and the list of ids with a one-line meaning each (the catalog) lives in the shared rules package so the capture server can offer it to Claude. The four layer pictograms (client, network, server, data) are always in the library. A concept with no `pictogram`, or with an id no longer in the library, is shown with its layer's pictogram (PD-026, FR-038).
- The illustration file is named after the concept id, `illustrations/<id>.svg`. The Markdown image link in the Illustration part is the only reference to it; there is no frontmatter field for it. The rules module enforces at most one such link per concept (BR-008).
- Write order: the capture server writes the SVG first (temporary file, then rename), then the concept file. An interrupted save may leave an orphan SVG; it never leaves a concept that points to a missing file. A retry of the same save overwrites the orphan.
- Security: illustrations are untrusted SVG. The rules module validates each one against an element and attribute allowlist at save, and again when it loads a concept: no script, no event handlers, no external references, no `foreignObject`, no DOCTYPE or entity declarations, and at most 200,000 characters of SVG text. The UI shows illustrations only as images (`<img>`), never inlined, and the local server serves them with a restrictive Content-Security-Policy and `X-Content-Type-Options: nosniff`.
- Hand-edited files (BR-008, FR-017): in every case below the concept loads and is also listed in `problems` with the file and the reason. An unknown pictogram id: the concept is drawn with its layer's pictogram (FR-038). More than one illustration link: the illustration is treated as absent. A link to a missing or invalid SVG: the concept loads without its illustration. `hasIllustration` is true only for exactly one link to a valid SVG. `extend_concept` with an illustration on a concept that already has a link, even a broken one, answers `already_present` and the author repairs the link by hand (replacing would break "a capture never replaces", FR-036).
- The HTTP API returns `seeI.illustration` with the Markdown image link removed (stripped by the server) plus `hasIllustration`; the UI shows the image only through `GET /api/concepts/{id}/illustration`, as an `<img>`.
- Adding a pictogram or illustration later is additive: a capture can add either to a concept that has none and is rejected for one that has it (FR-036).

## Consequences
### Positive
- Concept files stay diffable text; deleting every SVG leaves every concept complete.
- One validation path for pictograms and illustrations, shared by capture and the server.

### Negative / Trade-offs
- A hand edit can break the link or the SVG; the rules module then treats the illustration as absent and reports the file and reason (FR-017) instead of hiding the concept.
- Orphan SVG files from interrupted saves are harmless but accumulate until the author removes them.
- Preview adds a temporary page and SVG copy in the operating system's temp folder that the server does not clean up (addendum below).

## Verification / Revisit Trigger
- A test round-trips a concept with a pictogram and an illustration through write and parse with no field lost.
- A test kills the writer between the two writes and finds no concept pointing to a missing file.
- Tests feed SVGs with script, event handlers, external references and `foreignObject` and expect rejection.
- A test sends a DOCTYPE, an entity declaration and an SVG over the size cap and expects rejection.
- Tests load hand-edited concepts with an unknown pictogram id, two illustration links, and a link to a missing or invalid SVG; each loads, appears in `problems`, and `extend_concept` with an illustration answers `already_present`.
- Test: the HTTP concept payload has no Markdown image link in `seeI.illustration`.
- Revisit if the allowlist blocks illustrations the author wants, or if a viewer needs the illustration inside the `.md`.

## Addendum — preview before acceptance (review RV-002, F-010)
Accepted by: author, 2026-11-01, «Browser preview tool (Recommended)». This adds a consequence and leaves the Decision above unchanged.
- The capture server offers a fifth tool, `preview_illustration` (`docs/design/api/capture-tools.schema.json`). It validates the proposed SVG with the same rules-module validator as save, writes a temporary HTML page in the operating system's temp folder that shows the SVG only as an image (an `<img>` pointing at the validated SVG file beside the page, no inline SVG), opens it with the operating system's default browser and returns the page path. Rejection is `invalid_illustration` with the validator's reasons.
- It never writes into the store and does not need the app running (FR-013). Claude calls it before asking the author to accept, ask again or decline (FR-035, `docs/design/ux/flows.mmd`).
- Verification: a test feeds `preview_illustration` a valid SVG and finds the page and file outside the store with an `<img>` and no `<svg>` in the page; the store folder is byte-identical afterwards; an invalid SVG is rejected with no page written.
