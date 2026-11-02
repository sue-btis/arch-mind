# System Design Review

This file is review evidence and workflow state for the current baseline only. It is not a canonical product, architecture, schema, or contract authority. A new baseline rewrites it, carrying over findings still `OPEN`, `ACCEPTED`, or `BLOCKED` with their IDs; resolved and invalid ones stay in git history.

All enum values below stay in English, whatever language the prose uses.

## Review State

- Baseline ID: `RV-003`
- Current review mode: `follow_up_verification`
- Reconciliation cycles used: `1`
- Maximum automatic reconciliation cycles: `3`
- Current verdict: `Approved for build planning`
- Escalate exit: `none`
- Reviewed by: an independent reviewer subagent (not the design author), 2026-11-01, medium effort. It ran the new-baseline review, then a follow-up verification of reconciliation cycle 1. Diff range: `git diff` against HEAD c45a427 (branch `docs/finder-and-scale/Josue`, uncommitted) plus the untracked `ADR-010-grouped-layer-view-layout.md`, `docs/design/ux/scale-flow.mmd` and the change folder. The reviewer's rules forbid writing repository files, so the main thread saved this record from its reports.

## Mechanical Checks

| Command | Result |
|---|---|
| `node ".../software-design-skills/1.6.0/skills/reviewing-system-design/scripts/check-package.mjs" .` | Fail, exit 1 (follow-up): "[mvp] FR-044 … in no milestone or change spec", "[mvp] FR-049 … in no milestone or change spec", "2 problem(s) found." See F-027 |
| Manifest `checks:` commands | None: `docs/spec/manifest.yaml` has no `checks:` key |
| Ajv / `yaml` parse of the data schemas, the capture contract and `openapi.yaml` | Not rerun: `git diff --name-only -- docs/design/api docs/design/data` is empty (unchanged since RV-002, where they passed) |
| Redocly lint | Unverified: no Redocly CLI on PATH |
| Structurizr DSL validator | Unverified: no Structurizr CLI on PATH; `architecture.dsl` checked by reading only |
| Mermaid CLI | Unverified: `mmdc` not installed; `scale-flow.mmd` read manually |
| `@dbml/core` | Not applicable: persistent data is JSON Schema |
| `docs/site/` regeneration | Not rerun; `grep` finds the new components, ADR-010 and scale-flow in `arch-mind-architecture.html` |

## Current Blocking Summary

| Severity | Open | Ready for verification | Resolved | Accepted/Invalid |
|---|---:|---:|---:|---:|
| BLOCKER | 0 | 0 | 0 | 0 |
| MAJOR | 0 | 0 | 3 | 0 |
| MINOR | 0 | 0 | 4 | 1 |
| NOTE | 3 | 0 | 4 | 0 |

## Findings

### F-004 — Recall question ids are declared "never reused", but no component can enforce it
- Severity: `MINOR`
- Status: `ACCEPTED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/architecture.dsl` (with `docs/design/data/concept.schema.json`)
- Related requirements: BR-006, BR-007, FR-012, FR-016
- Evidence: carried over from RV-001 and RV-002. `concept.schema.json:62` "Never reused". `capture-tools.schema.json:165` continues ids "after the highest q-number in the stored file".
- Why it matters: silent mis-scheduling in a rare edge case.
- Required resolution: state how reuse is prevented, or record it as accepted risk.
- Verification evidence: unchanged by this baseline.
- Routed to: —
- Accepted by: author, 2026-10-31, «Accept recommended» (limitation L-2 in `docs/changes/2026-10-31-M04-daily-review/verification.md`); minor debt retained.

### F-007 — PD-016 and PD-017 are still open; the design has a parameterized default for each
- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/product/prd.md`
- Related requirements: FR-006, FR-028, FR-029
- Evidence: carried over. PD-016 and PD-017 are still `Open` in PRD §15.
- Why it matters: nothing blocks; the build plan treats these as dependencies.
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
- Evidence: carried over; `openapi.yaml` unchanged by this baseline.
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
- Evidence: carried over; unchanged.
- Why it matters: contract tests will not check the concept shape.
- Required resolution: `$ref` the data schema, or keep the pointer deliberately; declare 400.
- Verification evidence: unchanged.
- Routed to: —
- Accepted by: —

### F-020 — ADR-010 labels a closed-group connection with the type instead of the count, which contradicts FR-048
- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MAJOR_INCONSISTENCY`
- Owner: `docs/design/architecture/adr/ADR-010-grouped-layer-view-layout.md`
- Related requirements: FR-048, PD-029, PD-032
- Evidence: FR-048 (`prd.md:205-206`) "one labeled connection per pair with the number of relations it stands for"; `domain.md:33` "one connection per pair with a count". ADR-010:34 "labeled with the type when all share one, otherwise with the count", so a pair whose relations share one type shows no count. No PRD §15 row decides this.
- Why it matters: manifest rule "Product behavior may not be changed by a technical artifact without a decided PRD §15 row"; milestone acceptance tests would differ depending on which source the implementer follows.
- Required resolution: either ADR-010 shows the count on every connection (optionally with the type), or a PRD §15 decision amends FR-048 and `domain.md`.
- Verification evidence: `ADR-010:34`: every edge carries the number of relations it stands for, plus their type when they all share one (FR-048); matches FR-048 (`prd.md:205`) and `domain.md:33`.
- Routed to: —
- Accepted by: —

### F-021 — No behavior is defined when opening a group drops the grouped view below the 0.85 Fit floor
- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/adr/ADR-010-grouped-layer-view-layout.md` (with the NFR-001 row of `quality-attributes.md`; PRD §15 if the visible behavior is a product choice)
- Related requirements: NFR-001, FR-023, FR-047, FR-048
- Evidence: ADR-010:31 "Fit may drop when a group opens". Probe check (2) at ADR-010:46 does not check Fit. The Phase 3 acceptance in `quality-attributes.md:6` covers only "every group closed". FR-048 makes opening a group unconditional; NFR-001 and FR-023 refuse any view below 0.85 (ADR-008:53).
- Why it matters: implementers will diverge (refuse the open, replace the view with the FR-023 message, close other groups, or draw below the floor in breach of NFR-001), and each is visible product behavior.
- Required resolution: state what happens when opening a group would take Fit below 0.85 (a PRD §15 decision if it changes what the author sees); add a Fit condition to probe check (2) and to the Phase 3 acceptance; state the same for a grouped view below 0.85 with every group closed.
- Verification evidence: PD-035 (`prd.md:353`) and FR-049 (`prd.md:208`); `ADR-010:46` probe check (2) requires Fit ≥ 0.85 or the group kept closed; `ADR-010:49-50` addendum covers the open group and the all-closed grouped view; `quality-attributes.md:6` Phase 3 acceptance; `scale-flow.mmd:13-22`.
- Routed to: —
- Accepted by: —

### F-022 — The FR-047 ways out for a refused matrix view are undefined, and the domain limits Focus to the layer view
- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MAJOR_INCONSISTENCY`
- Owner: `docs/design/domain.md` (with `docs/design/ux/scale-flow.mmd`; `docs/product/prd.md` if FR-045/FR-047 are narrowed)
- Related requirements: FR-022, FR-023, FR-045, FR-047, FR-048, NFR-001
- Evidence: FR-023 and FR-047 (`prd.md:167`, `:202-203`) apply to "a view"; FR-045 focuses "the view". The matrix is refused by width too (`DESIGN.md:227`). `domain.md:31` defines Focus as "A state of the layer view". `scale-flow.mmd` models only the layer view. PD-029 keeps a grouped matrix in future scope.
- Why it matters: from a refused matrix, implementers could offer only narrower filters (breaks FR-047), add a focused matrix (contradicts `domain.md:31`), or switch to the Layers view (stated nowhere).
- Required resolution: state in the domain and the flow what each choice does when the refused view is the matrix, or narrow FR-045/FR-047 through a PRD §15 row.
- Verification evidence: PD-036 (`prd.md:354`) and FR-047 (`prd.md:202`); `domain.md:31` (focus from a refused matrix opens the layer view) and `:33`; `scale-flow.mmd:5,7,9,11` matrix branch.
- Routed to: —
- Accepted by: —

### F-023 — ADR-010 relies on an "ADR-008 Amendment 1" and ADR-008 invariants that ADR-008 does not contain
- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/design/architecture/adr/ADR-008-layer-plates-renderer.md` (with ADR-010 and the `layout` component of `architecture.dsl`)
- Related requirements: FR-048, NFR-001, FR-019
- Evidence: ADR-010:47 cites "ADR-008 Amendment 1"; ADR-008 has only the Fit addendum. The one-graph, elk-routes-all decision is M05 Amendment 1 (`docs/changes/2026-11-01-M05-layer-plates/spec.md:35`). ADR-008:22,25 and `architecture.dsl:12` still describe a per-layer layout. The scene invariants cited by ADR-010:13,19 and `quality-attributes.md:66` live in `DESIGN.md:233` and the M05 tests.
- Why it matters: a reader following ADR-010's references finds no authority for the invariants its probe tests.
- Required resolution: record M05 Amendment 1 and the scene invariants in ADR-008 (addendum) or `quality-attributes.md`; correct the ADR-010 reference and the `layout` component description.
- Verification evidence: `ADR-008:52-60` addendum "One elk graph" with the M05 Amendment 1 quote (matches `docs/changes/2026-11-01-M05-layer-plates/spec.md:35`) and the scene invariants; `ADR-010:46-47`, `architecture.dsl:12` and `quality-attributes.md:66` cite it.
- Routed to: —
- Accepted by: —

### F-024 — ADR-008 and DESIGN.md still say the refusal only suggests narrower filters
- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/design/architecture/adr/ADR-008-layer-plates-renderer.md`
- Related requirements: FR-023, FR-047, PD-031
- Evidence: ADR-008:53 "suggests narrower filters". `DESIGN.md:227` and `DESIGN.md:164` ("Deferred … the Ctrl K finder and legend type isolation") predate the amendment.
- Why it matters: DESIGN.md wording is what the UI milestone reads; it is not a manifest authority and the spec defers DESIGN.md changes to the milestones.
- Required resolution: update ADR-008:53 to FR-047; route the DESIGN.md fit-message and "Deferred" updates to the Phase 3 milestones.
- Verification evidence: `ADR-008:62` offers the FR-047 ways out. `DESIGN.md:164` and `:227` remain stale and are routed to the Phase 3 milestones.
- Routed to: `writing-build-plan` (Phase 3 milestones update `DESIGN.md:164` and `DESIGN.md:227`)
- Accepted by: —

### F-025 — Finder scope and the legend filter combined with a selection are undefined
- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/domain.md` (with `docs/design/ux/scale-flow.mmd`)
- Related requirements: FR-043, FR-044, FR-039, FR-041
- Evidence: FR-043 makes the chosen concept the selection. `domain.md:34` does not say whether the finder searches the whole store or only the shown concepts, nor what happens to a filtered-out choice. FR-044 and the selection both make things recede; no artifact defines them together. `scale-flow.mmd` reaches the finder and legend only from the layer view at Fit.
- Why it matters: small but visible differences between implementations.
- Required resolution: state the finder's search set and its effect on filters, and how the legend filter and a selection combine; record a §15 row if it is a product choice.
- Verification evidence: PD-037 (`prd.md:355`) and FR-043 (`prd.md:190`); `domain.md:34` (Finder) and `:35` (Legend type filter intersects with the selection); `scale-flow.mmd:26-29`.
- Routed to: —
- Accepted by: —

### F-026 — Direction of grouped connections and links between an open and a closed group are undefined
- Severity: `MINOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/adr/ADR-010-grouped-layer-view-layout.md`
- Related requirements: FR-020, FR-048
- Evidence: FR-020 draws directed arrows; FR-048, `domain.md:33` and ADR-010:34 say "one connection per pair" without saying whether pairs are ordered, or how a relation between a concept in an open group and a closed group is drawn.
- Why it matters: affects the edge model handed to elk and the counts shown.
- Required resolution: state whether pairs are directed, and how a concept-to-closed-group relation is drawn and counted.
- Verification evidence: `ADR-010:34`: A → B and B → A are separate edges (FR-020); concept-to-closed-group edges counted the same way; `domain.md:33`.
- Routed to: —
- Accepted by: —

### F-027 — check-package: FR-044 is in no milestone, because the Phase 3 plan is written after approval
- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/build/plan.md`
- Related requirements: FR-023, FR-043 to FR-048, BR-009
- Evidence: check-package after reconciliation cycle 1 reports "[mvp] FR-044 is in the MVP but in no milestone or change spec" and "[mvp] FR-049 is in the MVP but in no milestone or change spec". PRD §12 places Phase 3 before `### Out`, so the script counts it as MVP; it matches IDs literally (`check-package.mjs:165`). Same workflow pattern as F-017 in RV-002.
- Why it matters: workflow order, not a design defect.
- Required resolution: `writing-build-plan` adds Phase 3 milestones citing FR-023, FR-043, FR-044, FR-045, FR-046, FR-047, FR-048, FR-049 and BR-009 each by ID; rerun check-package.
- Verification evidence: `docs/build/plan.md` milestones M08 to M10 cite FR-023, FR-043 to FR-049 and BR-009, with coverage matrix rows; check-package reports "Package checks passed." (main thread, 2026-11-01, mechanical check)
- Routed to: `writing-build-plan`
- Accepted by: —

### F-028 — The persistent schema and the capture contract do not say that domain order matters
- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/design/data/concept.schema.json` (with `docs/design/api/capture-tools.schema.json`)
- Related requirements: BR-009, PD-033, FR-006
- Evidence: `domain.md:50` "The order of its domains is meaningful". `concept.schema.json:14` and `capture-tools.schema.json:157` are silent. No contradiction: arrays are ordered and nothing in `packages` sorts domains.
- Why it matters: a capture that proposes domains in catalog order decides the author's grouping without the author knowing.
- Required resolution: optionally state in both descriptions that the first domain is the group (BR-009) and that order is preserved.
- Verification evidence: `concept.schema.json:14` and `capture-tools.schema.json:157` state that order is preserved and the first domain is the group (BR-009); both parse.
- Routed to: —
- Accepted by: —

### F-029 — The PD-029 quote does not show that "B zoom semántico" is the grouped layer view, or that the grouped matrix was declined
- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `EDITORIAL`
- Owner: `docs/product/prd.md`
- Related requirements: FR-048, §14
- Evidence: the PD-029 quote names the chosen options only; the option list is not recorded.
- Why it matters: a later reader cannot check the decision against the quote.
- Required resolution: optionally list the options offered (A to D) in the row or the change folder.
- Verification evidence: PD-029 (`prd.md:348`) lists options A to D and states that C stays future scope.
- Routed to: —
- Accepted by: —

### F-030 — No relationship connects the plates renderer to the navigation and grouping components
- Severity: `NOTE`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/design/architecture/architecture.dsl`
- Related requirements: FR-045, FR-048
- Evidence: `architecture.dsl:55-56` add only `navigation -> selection` and `grouping -> layout`.
- Why it matters: the dependency direction of the new components is implicit.
- Required resolution: optionally add the relationships.
- Verification evidence: `architecture.dsl:57-59` adds plates → navigation, navigation → grouping, plates → grouping (read only; no Structurizr CLI).
- Routed to: —
- Accepted by: —

## Cycle History

### New baseline RV-003 — cycle 0
- Opened by: the Phase 3 change `docs/changes/2026-11-01-finder-and-scale/spec.md`, after RV-002 was approved.
- Carried over from RV-002: F-004 (MINOR, `ACCEPTED`), F-007, F-008, F-009 (NOTE, `OPEN`).
- Resolved in RV-002 and dropped from this ledger: F-010 to F-019.
- BLOCKER open: `0`; MAJOR open: `3` (F-020, F-021, F-022); MINOR open: `4` (F-023 to F-026); NOTE open: `7` (F-007, F-008, F-009, F-027 to F-030).
- Verdict: `Needs design revision`.

Checked with no finding:
- NG-003: the grouped view and focus are offered only from the would-not-fit message, so they are not "the main way to explore".
- §12 Out vs FR-045: the "separate view showing only one concept" item is removed from Out and §14; "other layouts" reads as views other than the layer and matrix views.
- Search in §12 Out is limited to concept text, with FR-043 carved out.
- BR-003: four fixed layers preserved.
- BR-009 vs `concept.schema.json` `domains`: ordered, `uniqueItems`, no `minItems`, so the "No domain" group can occur.
- PD-011 is compatible with PD-031.
- PD-028, PD-030 to PD-034: quotes match, traced in §12 and §16.
- ADR-010 is `Accepted` with an "Accepted by" quote; reversibility stated.
- The non-persistence rule for focus, grouping, the finder and the legend filter is consistent with `domain.md:31`.
- NFR-001 acceptance in the PRD matches the Phase 3 evidence in `quality-attributes.md:6`.

### Reconciliation cycle 1 (main thread, 2026-11-01)
- Author decisions taken for this cycle, recorded in PRD §15:
  - PD-035 «Uno abierto a la vez (Recommended)» (F-021);
  - PD-036 «Llevan a capas (Recommended)» (F-022);
  - PD-037 «Todo el store (Recommended)» (F-025).
- Change set:
  - `docs/product/prd.md`:
    - FR-043: every concept in the store; a hidden choice clears the filters (PD-037);
    - FR-047: from a refused matrix, filters keep the matrix, while focus and grouping open the layer view (PD-036);
    - FR-049 added: one open group, and a group that would not fit stays closed (PD-035);
    - Phase 3 cites FR-045 to FR-049;
    - PD-029 lists the options offered (F-029);
    - PD-035 to PD-037 added;
    - §16 updated.
  - `ADR-010`:
    - connections are directed, one per ordered pair, and always carry their count, plus the type when shared (F-020, F-026);
    - concept-to-closed-group edges;
    - probe check 2 includes Fit or stays closed;
    - addendum for the open group and the grouped-view floor, quoting PD-035 (F-021);
    - reference corrected to the ADR-008 addendum (F-023).
  - `ADR-008`:
    - addendum "One elk graph", recording M05 Amendment 1 with its quote and the scene invariants (F-023);
    - refusal now offers the FR-047 ways out (F-024).
  - `architecture.dsl`: `layout` description; plates → navigation, navigation → grouping and plates → grouping relationships (F-023, F-030).
  - `domain.md`:
    - Focus from the matrix opens the layer view (F-022);
    - Group: one open at a time;
    - Grouped layer view: directed counted connections;
    - Finder: the whole store, clears hiding filters (F-025);
    - new term "Legend type filter", which intersects with the selection (F-025).
  - `docs/design/ux/scale-flow.mmd`: matrix branch, grouped-view floor, single open group, finder over the whole store, legend with a selection (F-021, F-022, F-025).
  - `quality-attributes.md`: Phase 3 acceptance adds the single-group Fit condition; the rule cites the ADR-008 addendum (F-021, F-023).
  - `concept.schema.json` and `capture-tools.schema.json`: domain order preserved, first domain is the group (F-028).
  - `docs/site/` regenerated.
- F-024 DESIGN.md parts (fit-message wording, "Deferred" line) are routed to the Phase 3 milestones, as the finding allows.
- Checks:
  - check-package reports FR-044 and FR-049 in no milestone (F-027, routed to `writing-build-plan`);
  - both JSON schemas parse;
  - `pnpm --filter @arch-mind/rules test` 78/78;
  - `pnpm --filter @arch-mind/capture test` 17/17.
- Expected verification evidence: each READY_FOR_VERIFICATION finding's required resolution is met in the paths above, with no new contradiction.

### Follow-up verification after reconciliation cycle 1 (2026-11-01)
- Verified by an independent reviewer subagent at medium effort.
- Resolved: F-020, F-021, F-022 (MAJOR); F-023, F-024, F-025, F-026 (MINOR); F-028, F-029, F-030 (NOTE).
- F-024's DESIGN.md parts (`DESIGN.md:164`, `:227`) are routed to `writing-build-plan` for the Phase 3 milestones.
- Still open: F-007, F-008, F-009 and F-027 (NOTE). F-027 is routed to `writing-build-plan`; check-package reports FR-044 and FR-049.
- Regressions: none. CRITICAL_NEW: none. Unresolved BLOCKER + MAJOR: 3 → 0.
- PRD edits FR-043, FR-047 and FR-049 are authorized by PD-037, PD-036 and PD-035. The reviewer could not check the quotes against the author's messages: they come from the author's answers in the session that ran this change.
- Non-blocking observations for the Phase 3 milestone specs:
  - the grouped view refused with every group closed offers two choices, while FR-047 says three;
  - the finder may clear filters into a refused view, "the filters" could mean all filters or only the hiding facets, and the finder inside a closed group is not stated;
  - the ADR-008 addendum invariant list is a subset of `DESIGN.md:233` (it omits the 35 px plate-edge run and the 10 px lane spacing);
  - the `Study UI` container description at `architecture.dsl:11` still says it lays out each layer.
- Verdict: `Approved for build planning`; manifest `status: approved`.
