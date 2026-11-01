# System Design Review

This file is review evidence and workflow state for the current baseline only. It is not a canonical product, architecture, schema, or contract authority. A new baseline rewrites it, carrying over findings still `OPEN`, `ACCEPTED`, or `BLOCKED` with their IDs; resolved and invalid ones stay in git history.

All enum values below stay in English, whatever language the prose uses.

## Review State

- Baseline ID: `RV-002`
- Current review mode: `follow_up`
- Reconciliation cycles used: `1`
- Maximum automatic reconciliation cycles: `3`
- Current verdict: `Approved for build planning`
- Escalate exit: `none`
- Reviewed by: independent reviewer subagent (not the design author), 2026-11-01, new-baseline review of the Phase 2 change `docs/changes/2026-11-01-illustrated-study-direction/spec.md`. Diff range: `git diff development` (HEAD 2fc836c, branch `docs/illustrated-plates/Josue`) plus the untracked files (change folder, ADR-008, ADR-009). Scope: the authorities the change touches plus global contradictions. Follow-up verification of cycle 1: independent reviewer subagent, 2026-11-01, medium effort; scope = READY_FOR_VERIFICATION findings plus the cycle-1 change set.

## Mechanical Checks

| Command | Result |
|---|---|
| `node "~/.claude/plugins/cache/changesmith/software-design-skills/1.6.0/skills/reviewing-system-design/scripts/check-package.mjs" .` | Fail, exit 1: "[mvp] FR-036 is in the MVP but in no milestone or change spec", "[mvp] FR-037 is in the MVP but in no milestone or change spec", "2 problem(s) found." See F-017 |
| Manifest `checks:` commands | None: `docs/spec/manifest.yaml` has no `checks:` key |
| Ajv 8.20.0 draft 2020-12, `strict: true`, compile of `concept.schema.json`, `facets.schema.json`, `review-line.schema.json` | Pass: all 3 compile |
| Ajv 8.20.0 draft 2020-12, `strict: false`, `$ref` compile of every `capture-tools.schema.json` tool input/output schema (4 tools) and `#/$defs/rejection`, plus sample instances | Pass: all 9 compile; sample instances behave as designed (pictogram pattern, `minItems: 4` catalog) |
| `yaml@2.9.1` parse of `docs/design/api/openapi.yaml` | Pass: OpenAPI 3.1.0; includes `/api/concepts/{id}/illustration` |
| Redocly lint | Unverified: no Redocly CLI on PATH |
| Structurizr DSL validator | Unverified: no Structurizr CLI on PATH; `architecture.dsl` checked by reading only |
| Mermaid CLI | Unverified: not installed; `flows.mmd` and the `domain.md` state diagram read manually |
| `@dbml/core` | Not applicable: persistent data is JSON Schema |

## Current Blocking Summary

| Severity | Open | Ready for verification | Resolved | Accepted/Invalid |
|---|---:|---:|---:|---:|
| BLOCKER | 0 | 0 | 0 | 0 |
| MAJOR | 0 | 0 | 2 | 0 |
| MINOR | 0 | 0 | 5 | 1 |
| NOTE | 3 | 0 | 3 | 0 |

## Findings

### F-004 — Recall question ids are declared "never reused", but no component can enforce it

- Severity: `MINOR`
- Status: `ACCEPTED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/architecture.dsl` (with `docs/design/data/concept.schema.json`)
- Related requirements: BR-006, BR-007, FR-012, FR-016
- Evidence: carried over from RV-001. `concept.schema.json:62` "Never reused". `capture-tools.schema.json:165` continues ids "after the highest q-number in the stored file", so a hand edit that deletes the highest-numbered question lets its id, and its history, be reissued.
- Why it matters: silent mis-scheduling in a rare edge case.
- Required resolution: state how reuse is prevented, or record it as accepted risk.
- Verification evidence: Accepted risk (MINOR, ledger rules allow ACCEPTED for retained debt): no design change in this cycle.
- Routed to: —
- Accepted by: author, 2026-10-31, «Accept recommended» (limitation L-2 in `docs/changes/2026-10-31-M04-daily-review/verification.md`); minor debt retained.

### F-007 — PD-016 and PD-017 are still open; the design has a parameterized default for each

- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/product/prd.md`
- Related requirements: FR-006, FR-028, FR-029
- Evidence: carried over from RV-001. PD-016 and PD-017 are `Open` in PRD §15.
- Why it matters: nothing blocks; the build plan should treat these as dependencies.
- Required resolution: none for approval.
- Verification evidence: unchanged.
- Routed to: —
- Accepted by: —

### F-008 — The OpenAPI file does not state that no credentials are required

- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `EDITORIAL`
- Owner: `docs/design/api/openapi.yaml`
- Related requirements: NFR-005
- Evidence: carried over from RV-001. There is still no `security` key; the new illustration operation adds one more operation without it.
- Why it matters: the Redocly recommended ruleset fails, and the no-token decision stays implicit.
- Required resolution: `security: []` at the root, or a Redocly config that turns the rule off intentionally.
- Verification evidence: not rerun (no Redocly available).
- Routed to: —
- Accepted by: —

### F-009 — The OpenAPI `Concept` schema is only partly typed, and no 400 response is declared for invalid bodies

- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/design/api/openapi.yaml`
- Related requirements: FR-025, FR-032
- Evidence: carried over from RV-001. `Concept` now types only `pictogram` and `hasIllustration`; the rest is a prose pointer. `POST /api/reviews` still declares no 400.
- Why it matters: contract tests will not check the concept shape.
- Required resolution: `$ref` the data schema, or keep the pointer deliberately; declare 400.
- Verification evidence: partly changed by RV-002; still open.
- Routed to: —
- Accepted by: —

### F-010 — The author cannot see a proposed visual illustration before accepting it

- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/ux/flows.mmd` (with `docs/design/api/capture-tools.schema.json` and `docs/design/architecture/architecture.dsl`)
- Related requirements: FR-035, FR-036, BR-004, PD-025, UX-004
- Evidence: FR-035 saves the illustration only after the author accepts it; PD-025 says the author accepts, asks again or declines. `flows.mmd:17-20` has Claude Code show the proposed illustration in the conversation, which is a terminal conversation, so the author would see SVG source. No artifact defines a preview: the capture contract's 4 tools do not render or preview, the capture server has no preview component, and the only illustration endpoint serves saved concepts only.
- Why it matters: the confirmation BR-004 and FR-035 require cannot be made meaningfully, and implementers would diverge (temp file opened unvalidated, a preview tool, a preview endpoint, a text description), some adding a contract or a trust boundary.
- Required resolution: define how a proposed illustration is shown before acceptance (mechanism, owner, validated against the ADR-009 allowlist and shown only as an image under the same barriers); update `flows.mmd`; cover any new tool or endpoint in the contract and the threat table.
- Verification evidence: Resolution: author decision 2026-11-01, «Browser preview tool (Recommended)». New capture tool `preview_illustration` (capture-tools.schema.json): same validator as save, temp HTML page outside the store showing the SVG only as `<img>`, opened in the default browser, no store write, works with the app closed. Recorded as an addendum to ADR-009 (decision unchanged); also `flows.mmd`, `architecture.dsl` (component `preview`), `quality-attributes.md` (threat row, NFR-002). Changed: docs/design/api/capture-tools.schema.json, docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md, docs/design/ux/flows.mmd, docs/design/architecture/architecture.dsl, docs/design/architecture/quality-attributes.md. Expected evidence: the tool exists in the contract with `invalid_illustration`, the flow calls it before accept, the threat table has the temp page row.
- Routed to: —
- Accepted by: —

### F-011 — "Fits at Fit size" is undefined once Fit scales the SVG viewBox, so the FR-023 refusal trigger has no criterion

- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MAJOR_INCONSISTENCY`
- Owner: `docs/design/architecture/quality-attributes.md` (NFR-001 row) with `docs/design/architecture/adr/ADR-008-layer-plates-renderer.md`
- Related requirements: NFR-001, FR-023, FR-042
- Evidence: `quality-attributes.md:6` sets the viewBox to the window width and refuses a view that does not fit at Fit size; a viewBox fitted to the width always fits, so the refusal can never fire without a scale or readability floor. NFR-001 asks that every pictogram and label be readable without a threshold; ADR-008 repeats "readable" with no number. The current FR-023 behavior is natural-width based (`packages/rules/fixtures/tst-032.ts:306`, M03 TST-014).
- Why it matters: implementers would never refuse, keep a scale-1 check, or pick a minimum scale arbitrarily; FR-023, already built and tested, could silently stop working.
- Required resolution: state the Fit scale and a measurable refusal condition; ADR-008's verification and NFR-001's milestone acceptance use it.
- Verification evidence: Resolution: author decision 2026-11-01, «Shrink with a floor (Recommended)». Fit scale = min(1, available board width / projected width at scale 1); refusal (FR-023) when the scale is below max(11/13, 32/44) = 0.85, with base sizes labels 13 px and pictograms 44 px stated in ADR-008 (addendum and verification). Changed: docs/design/architecture/quality-attributes.md (NFR-001 row), docs/design/architecture/adr/ADR-008-layer-plates-renderer.md. Expected evidence: NFR-001 acceptance and ADR-008 verification use the 0.85 condition.
- Routed to: —
- Accepted by: —

### F-012 — ADR-007 still decides React Flow for the layer view, with no supersession marker

- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/design/architecture/adr/ADR-007-ui-foundation.md`
- Related requirements: UX-001, FR-019
- Evidence: ADR-007:11 and :39 keep React Flow for the layer view with status `Accepted`; ADR-008:38 removes React Flow; `quality-attributes.md:61` forbids `@xyflow/react`.
- Why it matters: a reader of ADR-007 alone gets the opposite instruction; ADR-008 and the rule make intent clear, hence MINOR.
- Required resolution: ADR-007 carries "Partially superseded by: ADR-008 (layer view drawing)".
- Verification evidence: Resolution: ADR-007 now carries "Partially superseded by: ADR-008 (layer view drawing)". Changed: docs/design/architecture/adr/ADR-007-ui-foundation.md.
- Routed to: —
- Accepted by: —

### F-013 — PRD §12 Out and §14 still exclude a "focus view (a concept and its neighbors)", while FR-039 to FR-041 bring the neighbourhood forward

- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/product/prd.md`
- Related requirements: FR-039, FR-040, FR-041, PD-020, PD-021
- Evidence: §12 Out "Focus view (a concept and its neighbors)"; §14 "Focus view starting from one concept"; FR-039 highlights the neighbourhood in place; `quality-attributes.md:20` speaks of "selection and focus".
- Why it matters: the Out item reads as excluding exactly what FR-039 to FR-041 add.
- Required resolution: narrow the Out and §14 items to a separate view showing only one concept and its neighbors.
- Verification evidence: Resolution: PRD §12 Out and §14 narrowed to "a separate view showing only one concept and its neighbors" (editorial; behavior decided by FR-039 to FR-041, PD-021). Changed: docs/product/prd.md.
- Routed to: —
- Accepted by: —

### F-014 — Load-time handling of BR-008 cases in hand-edited files is unspecified

- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md` (with `docs/design/domain.md`)
- Related requirements: BR-008, FR-017, FR-036, FR-038
- Evidence: `domain.md:139` reports hand edits that break BR-008, while `domain.md:82` and FR-038 fall back silently for an unknown pictogram id; ADR-009:32 does not say whether two links fail the load; `capture-tools.schema.json:84,148` leave "has an illustration" undefined for a broken link.
- Why it matters: rules-module behavior differs at the edges; a second link next to a broken one would break BR-008.
- Required resolution: for unknown pictogram id, more than one link, and a link with a missing or invalid SVG, state whether the concept loads, whether it is listed in `problems`, and whether `extend_concept` returns `already_present` or replaces the link.
- Verification evidence: Resolution: one rule in ADR-009 and domain.md. Unknown pictogram id, more than one illustration link, and a link to a missing or invalid SVG all load the concept (layer pictogram / illustration treated as absent) and list it in `problems` with the reason. `extend_concept` with an illustration on a concept with any link, even a broken one, answers `already_present` (a capture never replaces; the author repairs by hand). `hasIllustration` is true only for exactly one valid link. Changed: docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md, docs/design/domain.md, docs/design/api/capture-tools.schema.json, docs/design/api/openapi.yaml.
- Routed to: —
- Accepted by: —

### F-015 — The NFR-002 design response does not account for the pictogram and illustration proposals

- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `COVERAGE_GAP`
- Owner: `docs/design/architecture/quality-attributes.md`
- Related requirements: NFR-002, FR-034, FR-035
- Evidence: the NFR-002 row is unchanged; illustration SVG is generated for the proposal and again as the save argument, and each retry adds a generation; NFR-002 was never measured (DQ-006).
- Why it matters: the 60-second budget may be consumed by SVG generation.
- Required resolution: the NFR-002 response and evidence state that the 5 timed captures include a pictogram proposal and an illustration proposal (or record a tradeoff).
- Verification evidence: Resolution: NFR-002 response counts one `preview_illustration` call per illustration proposal; evidence says the 5 timed captures include a pictogram proposal and an illustration proposal with one preview. Changed: docs/design/architecture/quality-attributes.md.
- Routed to: —
- Accepted by: —

### F-016 — How the UI shows the image link inside the Illustration text is unspecified

- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/api/openapi.yaml` (with ADR-009)
- Related requirements: FR-025, UX-004, NFR-004
- Evidence: `concept.schema.json:24` keeps the Markdown link inside `seeI.illustration`; the HTTP `Concept` returns that shape; no artifact says whether the API strips the link or the UI replaces it with the illustration endpoint image.
- Why it matters: implementations differ in what the detail shows.
- Required resolution: state whether `seeI.illustration` reaches the UI with or without the link, and that the image is shown only through the illustration endpoint.
- Verification evidence: Resolution: the API returns `seeI.illustration` without the Markdown image link (stripped server-side) plus `hasIllustration`; the UI shows the image only through `GET /api/concepts/{id}/illustration`. Changed: docs/design/api/openapi.yaml, docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md.
- Routed to: —
- Accepted by: —

### F-017 — check-package: FR-036 and FR-037 are in no milestone, because the Phase 2 plan is written after approval

- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/build/plan.md`
- Related requirements: FR-034 to FR-042
- Evidence: the check-package output above; PRD §12 places Phase 2 before `### Out`, so the script counts it as MVP; the change spec writes Phase 2 milestones after approval; the rule "No React Flow in the UI" fails against current code (`packages/ui/package.json` `@xyflow/react`) until the plates milestone lands.
- Why it matters: workflow order, not a design defect.
- Required resolution: `writing-build-plan` adds Phase 2 milestones covering FR-034 to FR-042 by literal ID, with React Flow removal in the plates milestone; rerun check-package.
- Verification evidence: —
- Routed to: —
- Accepted by: —

### F-018 — SVG allowlist hardening: no DOCTYPE/entity rule and no size cap

- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md`
- Related requirements: NFR-006, BR-008
- Evidence: ADR-009:34 lists script, event handlers, external references and `foreignObject`, not DOCTYPE or entities; `illustrationSvg` has no `maxLength`; the rules module re-parses every SVG on each reload.
- Why it matters: optional hardening against entity expansion or oversized input.
- Required resolution: optionally add "no DOCTYPE or entity declarations" and a size cap.
- Verification evidence: Resolution: allowlist adds no DOCTYPE or entity declarations and a 200,000-character cap; `maxLength: 200000` on `illustrationSvg`; threat row updated. Changed: docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md, docs/design/api/capture-tools.schema.json, docs/design/architecture/quality-attributes.md.
- Routed to: —
- Accepted by: —

### F-019 — No rule keeps the pictogram catalog and the pictogram artwork in step

- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/design/architecture/quality-attributes.md`
- Related requirements: FR-037, FR-038, BR-008
- Evidence: ADR-009:31 puts the catalog in the rules package and the artwork in a UI asset; no architecture rule checks that every catalog id has artwork, including the four layer pictograms.
- Why it matters: a catalog id without artwork would be accepted at capture and drawn inconsistently.
- Required resolution: optionally add an architecture rule with a check.
- Verification evidence: Resolution: architecture rule added "every catalog pictogram id has artwork; the four layer pictogram ids exist" with a test check. Changed: docs/design/architecture/quality-attributes.md.
- Routed to: —
- Accepted by: —

## Cycle History

### New baseline RV-002 — cycle 0

- Opened by: the Phase 2 change `docs/changes/2026-11-01-illustrated-study-direction/spec.md`.
- Carried over from RV-001: F-004 (MINOR), F-007, F-008, F-009 (NOTE), all `OPEN`.
- Resolved since RV-001 and dropped from this ledger: F-005 (`domain.md:71` day rule) and F-006 (`architecture.dsl` `storeConfig` container).
- BLOCKER open: `0`
- MAJOR open: `2`
- MINOR open: `6`
- NOTE open: `6`
- Verdict: `Needs design revision`

Checked with no finding: ADR statuses and supersession for ADR-006/008/009; PD-021 to PD-027 decided and traced; schemas and tool contracts compile; NFR-003 write order; illustration referenced only by the Markdown link; `extend_concept` appending the link under FR-036/BR-004/BR-005; SVG trust boundary (allowlist at save and load, `<img>` only, CSP and `nosniff`, id-derived path); selection transient and never stored; plates width at Fit deferred to the milestone with an ADR-008 revisit trigger.

### Reconciliation — cycle 1

- Run by: `reconciling-system-design`, 2026-11-01. Author decisions: F-010 «Browser preview tool (Recommended)», F-011 «Shrink with a floor (Recommended)». F-004 carried as accepted by the author on 2026-10-31 («Accept recommended»).
- Attempted, now `READY_FOR_VERIFICATION`: F-010, F-011 (MAJOR); F-012, F-013, F-014, F-015, F-016 (MINOR); F-018, F-019 (NOTE). `ACCEPTED`: F-004. Left `OPEN` by instruction: F-007, F-008, F-009, F-017.
- Change set: `docs/design/api/capture-tools.schema.json` (tool `preview_illustration`, `maxLength`, DOCTYPE/size rule, broken-link semantics); `docs/design/api/openapi.yaml` (problems cases, link stripped from `seeI.illustration`); `docs/design/architecture/adr/ADR-007-ui-foundation.md` (supersession line); `docs/design/architecture/adr/ADR-008-layer-plates-renderer.md` (base sizes, Fit scale, 0.85 floor, addendum); `docs/design/architecture/adr/ADR-009-pictogram-and-illustration-storage.md` (allowlist hardening, hand-edit rules, API link stripping, preview addendum); `docs/design/architecture/architecture.dsl` (component `preview`); `docs/design/architecture/quality-attributes.md` (NFR-001, NFR-002, threat rows, architecture rule); `docs/design/domain.md` (load rules); `docs/design/ux/flows.mmd` (preview before acceptance); `docs/product/prd.md` (§12 Out, §14 wording, PD-021); `docs/spec/manifest.yaml` (status).
- Expected verification: the follow-up review checks each READY_FOR_VERIFICATION finding against the evidence recorded in the finding, and reruns `check-package.mjs` (F-017 remains).
- Reconciliation cycles used after this pass: `1` of `3`.

### Follow-up — cycle 1

- Reconciliation change set: as listed under "Reconciliation — cycle 1".
- Checks rerun 2026-11-01: check-package exits 1 with only the expected F-017 problems (FR-036, FR-037); Ajv 8.20.0 strict + ajv-formats compiles the data schemas; Ajv strict:false with the data schemas registered compiles all 5 capture tools (incl. `preview_illustration`) and all 11 `$defs`; `yaml@2.9.1` parses `openapi.yaml` (OpenAPI 3.1.0, 6 paths). Redocly, Structurizr and Mermaid remain unverified (not installed).
- Findings verified RESOLVED: F-010 (`capture-tools.schema.json:118-138`, `flows.mmd` preview block, `architecture.dsl` component `preview`, temp-page threat row, ADR-009:58-62); F-011 (NFR-001 row and ADR-008:53-54, Fit scale and 0.85 floor); F-012 (ADR-007:7); F-013 (PRD §12 Out, §14); F-014 (ADR-009:35, `domain.md`, `capture-tools.schema.json:85,170`, `openapi.yaml`); F-015 (`quality-attributes.md:7`); F-016 (`openapi.yaml` Concept, ADR-009:36,55); F-018 (ADR-009:34,53, `capture-tools.schema.json:15`); F-019 (architecture rule with test check).
- F-004 ACCEPTED (author, 2026-10-31, «Accept recommended», M04 limitation L-2). F-007, F-008, F-009, F-017 OPEN (NOTE); F-017 is resolved by the Phase 2 build plan.
- New regressions: none
- Critical new blockers: none
- BLOCKER open: `0`
- MAJOR open: `0`
- Previous BLOCKER+MAJOR open: `2`
- Current BLOCKER+MAJOR open: `0`
- Consecutive increases: `0`
- Verdict: `Approved for build planning`
- Observations for the build plan (not ledger findings): the NFR-002 prompt budget with `preview_illustration` (pre-allow it and check interactively in the capture milestone); ADR-009:54 groups the unknown-pictogram case with "extend_concept with an illustration answers already_present", while the Decision at ADR-009:35 governs (no link means an illustration is accepted).
- F-017 RESOLVED 2026-11-01: `docs/build/plan.md` adds M05 to M07 covering FR-034 to FR-042 by literal ID, with React Flow removal in M05 (TST-024); `check-package.mjs` now prints "Package checks passed."
