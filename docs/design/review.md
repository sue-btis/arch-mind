# System Design Review

This file is review evidence and workflow state for the current baseline only. It is not a canonical product, architecture, schema, or contract authority. A new baseline rewrites it, carrying over findings still `OPEN`, `ACCEPTED`, or `BLOCKED` with their IDs; resolved and invalid ones stay in git history.

All enum values below stay in English, whatever language the prose uses.

## Review State

- Baseline ID: `RV-001`
- Current review mode: `follow_up`
- Reconciliation cycles used: `1`
- Maximum automatic reconciliation cycles: `3`
- Current verdict: `Approved for build planning`
- Escalate exit: `none`
- Reviewed by: independent reviewer subagent (not the design author), 2026-10-30, baseline review. Follow-up verification after cycle 1: a separate independent reviewer subagent (neither the design author nor the reconciler), 2026-10-30. The repository is not under version control, so artifacts were read directly from the working tree.

## Mechanical Checks

| Command | Result |
|---|---|
| `node "~/.claude/plugins/cache/changesmith/software-design-skills/1.5.0/skills/reviewing-system-design/scripts/check-package.mjs" "<repo>"` | Pass: "Package checks passed.", exit 0 |
| Manifest `checks:` commands | None: `docs/spec/manifest.yaml` has no `checks:` key |
| `npx --yes @redocly/cli@1 lint docs/design/api/openapi.yaml` (recommended ruleset) | Fail: 5 errors (`security-defined` at 17:5, 38:5, 63:5, 82:5, 95:5) and 1 warning (`info-license` at 2:1). On the first run the process also hit a Windows libuv assertion at exit (exit 127); the stylish rerun gave the same findings. See F-008 |
| `npx --yes @redocly/cli@1 lint --extends=minimal --format=stylish docs/design/api/openapi.yaml` | Pass: "Your API description is valid", with 5 `security-defined` warnings |
| `node -e "JSON.parse(...)"` on each `docs/design/data/*.json` | Pass: all 3 files parse |
| `npx --yes -p ajv-cli@5 -p ajv-formats@3 ajv compile --spec=draft2020 -c ajv-formats -s concept.schema.json -s facets.schema.json -s review-line.schema.json` | Pass: all 3 schemas valid under draft 2020-12 |
| Structurizr DSL validator | Unverified: no Structurizr CLI on PATH. Java is present but there is no Structurizr jar. Docker is present but was not used, because the review must not start external systems. `architecture.dsl` was checked by reading only |
| `@dbml/core` | Not applicable: there is no DBML file; persistent data is defined by JSON Schema in `docs/design/data/` |
| Mermaid (`docs/design/ux/*.mmd`, diagrams in `domain.md`) | Unverified: no Mermaid CLI is installed, and none was installed. Read manually; no syntax problem seen |
| Follow-up: `check-package.mjs` (same command as above) | Pass: "Package checks passed.", exit 0 |
| Follow-up: `ajv compile --spec=draft2020 -c ajv-formats -s concept.schema.json -s facets.schema.json -s review-line.schema.json` (in `docs/design/data`) | Pass: all 3 schemas valid, exit 0 |
| Follow-up: `ajv compile --spec=draft2020 -c ajv-formats -s api/capture-tools.schema.json -r data/concept.schema.json` (in `docs/design`), default strict and `--strict=false` | Pass: "schema api/capture-tools.schema.json is valid", exit 0 in both modes. Weak evidence on its own: Ajv does not compile `$defs` entries that nothing references, so the tool schemas under `$defs.tools` were not reached |
| Follow-up: inline `node -e` with the cached `ajv/dist/2020` and `ajv-formats` (strict off, allErrors) compiling `{ $ref: "arch-mind/capture-tools.schema.json#/$defs/tools/<tool>/<inputSchema or outputSchema>" }` for all 4 tools and `#/$defs/rejection`, then validating sample instances | Pass: all 8 tool schemas and the rejection compiled, and every `concept.schema.json` ref resolved. A `get_concept` output with `recall[].confirmed` is valid; without it: "/recall/0 must have required property 'confirmed'". A `save_concept` input whose recall items carry `id`/`confirmed` is rejected (additional properties). `extend_concept` with only `id` is rejected ("must NOT have fewer than 2 properties"), and with `title` is rejected (additional properties); with one new recall question it is valid. A sample `saveResult` and a rejection with `path` `/relations/0/source` and rule `missing_source` are valid |
| Follow-up: Structurizr, Mermaid, Redocly | Not rerun. `architecture.dsl:19` (component description) and `review-flow.mmd:21` (message text) were read by hand; `openapi.yaml` did not change |

## Current Blocking Summary

| Severity | Open | Ready for verification | Resolved | Accepted/Invalid |
|---|---:|---:|---:|---:|
| BLOCKER | 0 | 0 | 0 | 0 |
| MAJOR | 0 | 0 | 3 | 0 |
| MINOR | 3 | 0 | 0 | 0 |
| NOTE | 3 | 0 | 0 | 0 |

## Findings

### F-001 — The confirmation date of a recall question is never stored, so its first due date cannot be computed

- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/data/concept.schema.json` (with `docs/design/architecture/adr/ADR-002-storage-format.md`)
- Related requirements: FR-030, FR-012, FR-026, BR-006
- Evidence:
  - FR-030 (`docs/product/prd.md:177-178`) says a new question "is due the day after capture". FR-012 (`prd.md:119-120`) lets recall questions be added to existing concepts later, so each question has its own confirmation day.
  - Recall items store only `id` and `question` (`docs/design/data/concept.schema.json:53-65`). No field records when the concept or the question was captured or confirmed. `episodes[].date` (`concept.schema.json:49`) is optional and describes the episode, not the capture.
  - The review log holds only review results (`docs/design/data/review-line.schema.json:8-13`), so a question with no reviews has no line at all.
  - `docs/design/architecture/quality-attributes.md:56` and `ADR-002-storage-format.md:22` say box and due date are always computed by replaying the log. That replay has no starting point for a question that has never been reviewed.
- Why it matters: the scheduler cannot work out FR-030's first due date from stored data. Implementers would have to invent a source: file modification time (which hand edits change, FR-016), the episode date, or a new field. ADR-002 is one-way (`ADR-002:8`), so a format added later means migrating every concept file.
- Required resolution: the canonical data schema defines where each recall question's confirmation date is stored (for example a required date on each `recall[]` item, set by capture and never edited). ADR-002 and the "never stored" architecture rule in `quality-attributes.md` must state that this date is the starting point of the replay.
- Changed in cycle 1: `docs/design/data/concept.schema.json` (recall item gains required `confirmed` date, written by capture, never edited); `docs/design/architecture/quality-attributes.md` (architecture rule: replay starts in box 1 on `confirmed`); `docs/design/domain.md` (Recall Question invariant); `docs/design/api/capture-tools.schema.json` (server assigns `confirmed` at save). ADR-002 left unchanged: its decision (box and due computed by replay) still holds, and editing an Accepted ADR would reopen it.
- Verification evidence:
  - `concept.schema.json:59` makes `confirmed` required on every recall item. `concept.schema.json:63` defines it as a `date`: the "local calendar day the author confirmed the question; written by capture, never edited. Starting point of the Leitner replay: box 1, due the next day (FR-030)". Ajv confirms that a stored concept without `confirmed` is invalid ("/recall/0 must have required property 'confirmed'").
  - The architecture rule at `quality-attributes.md:56` now starts each question "in box 1 on its `confirmed` day". Its check covers "a question with no reviews (due the day after `confirmed`)", so a never-reviewed question has a computable due date.
  - `domain.md:62` says the box and due date follow from the confirmation day, the review history and the box intervals, and that the confirmation day never changes.
  - The capture contract assigns the date at save in both `save_concept` (`capture-tools.schema.json:120`) and `extend_concept` (`capture-tools.schema.json:138`), so questions added later through FR-012 get their own day.
  - ADR-002 was not edited. This does not contradict anything: `ADR-002:22` lists frontmatter content in general terms and keeps "computed by replaying the lines", and manifest rule 1 (`manifest.yaml:52`) gives the more specific data schema ownership of the field.
- Routed to: —
- Accepted by: —

### F-002 — The capture boundary (MCP tools) has no canonical contract beyond the `save_concept` input

- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `COVERAGE_GAP`
- Owner: `docs/spec/manifest.yaml` (no authority owns the MCP tool contract) together with `docs/design/architecture/adr/ADR-003-capture-path.md`
- Related requirements: FR-002, FR-009, FR-010, FR-011, FR-012, UX-003, BR-004
- Evidence:
  - `docs/design/architecture/architecture.dsl:19` names four tools: `list_concepts, get_concept, save_concept, extend_concept`. It says only "input shape in docs/design/data/concept.schema.json".
  - `concept.schema.json:5` says it is "the input of the save_concept MCP tool". Nothing defines the input of `extend_concept`, the outputs of `list_concepts` and `get_concept`, or the shape of a rejection.
  - The manifest's authorities (`docs/spec/manifest.yaml:20-44`) cover `http_contract` only, and `events` is declared not applicable. No authority owns the MCP tool contract.
  - `docs/design/ux/flows.mmd:11` shows `list_concepts` returning "ids, titles, layers" and `flows.mmd:22` shows "rejected: the exact field or relation (UX-003)". This prose is the only place either behavior appears.
- Why it matters: this boundary is where every capture is checked. FR-012 needs adding to an existing concept "under the same rules". Without a contract, implementers must guess whether `extend_concept` takes a whole concept or only the new relations, questions, and episodes; who assigns new recall ids; and what happens when an added relation duplicates an existing (type, target). FR-009 to FR-011 and UX-003 need rejections that name the exact field, and no shape is defined for that. The skill and the server could be built against different shapes, and the `extend_concept` semantics bear directly on BR-001 to BR-005 integrity.
- Required resolution: add a canonical MCP tool contract (input and output schema for each of the four tools, plus the rejection result that names the field or relation) and register it in the manifest. It must define `extend_concept` as additive under the same rules and say who assigns new recall question ids.
- Changed in cycle 1: New `docs/design/api/capture-tools.schema.json` (input and output for list_concepts, get_concept, save_concept, extend_concept; rejection shape with JSON Pointer path and rule; server assigns recall ids and dates; extend_concept additive; duplicate (type, to) rejected); `docs/spec/manifest.yaml` (registered as `capture_api`); `docs/design/architecture/architecture.dsl` (MCP tools component points to the contract); `docs/design/data/concept.schema.json` (description points to the contract). ADR-003 left unchanged.
- Verification evidence:
  - Every tool named at `architecture.dsl:19` has an `inputSchema` and an `outputSchema`: `list_concepts` (`capture-tools.schema.json:59-93`), `get_concept` (`:94-99`), `save_concept` (`:100-121`) and `extend_concept` (`:122-139`). All eight compile in Ajv draft 2020-12 with their `concept.schema.json` refs resolved (see Mechanical Checks; the plain root compile does not reach them).
  - The rejection result (`capture-tools.schema.json:36-57`, mode stated at `:5`) requires `errors[]` items with a JSON Pointer `path`, a `rule` and a `message`. This satisfies UX-003 and FR-009 to FR-011: the rules `missing_source`, `missing_target` and `duplicate_id` are listed for `save_concept` at `:119`.
  - `extend_concept` is additive only (`:123`). Its input admits only `id` plus at least one of `relations`, `episodes` or `recall` (`:124-135`), and Ajv rejects `title` or a bare `id`. It reuses the same relation shape and rules (`:131`, `:137`). A duplicate (type, to) is rejected as `duplicate_relation` (`:138`).
  - The server assigns recall ids and `confirmed` dates. Callers cannot send them (`:10-16`, `:120`, `:138`), and Ajv rejects input recall items that carry them.
  - Owner registered: `manifest.yaml:38-40` (`capture_api` owns `mcp_tool_contract`, a concern no other authority owns). Pointers: `architecture.dsl:19`, `concept.schema.json:5`.
  - Manifest key check: `capture_api` is not in `references/manifest-template.yaml`. The template rule "holds only the keys in the template" (designing-system SKILL.md §7) is enforced on top-level keys (`check-package.mjs` `TOP_LEVEL_KEYS`), and entries under `authoritative_sources` are an open map: the checker validates any entry's path, and `render-package.mjs:303` falls back to the key as the section title. The template has no slot for an MCP tool contract, and this manifest already maps `data:` to a JSON Schema folder rather than `schema.dbml`. The deviation causes no ambiguity about which artifact is authoritative and creates no maintenance risk, so it is not BLOCKER or MAJOR, and no follow-up finding is raised.
- Routed to: —
- Accepted by: —

### F-003 — FR-031 "open the concept's relations in the layer view" conflicts with the focus view being out of the MVP

- Severity: `MAJOR`
- Status: `RESOLVED`
- Origin: `BASELINE`
- Classification: `MAJOR_INCONSISTENCY`
- Owner: `docs/product/prd.md`
- Related requirements: FR-031, FR-018, FR-019, J-003
- Evidence:
  - FR-031 (`prd.md:180-181`) says that after a wrong answer, the app offers to open the concept's relations in the layer view. It is in the MVP (`prd.md:232`, FR-026 to FR-032).
  - The MVP Out list (`prd.md:236`) excludes "Focus view (a concept and its neighbors)", and `prd.md:250` lists it as future scope.
  - Views are facet filters only: FR-018 (`prd.md:139-140`) and the "View" entry in `docs/design/domain.md:23`.
  - `docs/design/ux/review-flow.mmd:21` repeats FR-031 without saying which concepts the view selects.
  - `docs/design/api/openapi.yaml` has no neighbor query.
- Why it matters: one implementer would build a concept-and-neighbors selection, which is the excluded focus view. Another would open a facet filter made from the concept's facets, which may not show its relations at all, since targets can sit in other domains, concerns, or layers. These are materially different builds, and the choice is product behavior a technical artifact may not settle (`manifest.yaml` rule 3).
- Required resolution: a decided PRD §15 row from the author, with a verbatim quote, makes FR-031 and §12 consistent. Either FR-031 opens a facet-filtered layer view with the concept highlighted, or a minimal "concept plus direct relations" selection moves into the MVP and the Out item is narrowed. UX flows and the API then reflect the chosen behavior. If the decision cannot be obtained, set this finding to `BLOCKED`.
- Changed in cycle 1: `docs/product/prd.md` (PD-020 decided by the author, «Open the detail (Recommended)» (translated); FR-031 and J-003 step 3 now open the concept detail; traceability row); `docs/design/ux/review-flow.mmd` (wrong-answer step).
- Verification evidence:
  - FR-031 (`prd.md:180-181`) now reads "After a wrong answer, the app offers to open the concept's detail (FR-025)", so it no longer implies a neighbor view. J-003 step 3 (`prd.md:62`) matches.
  - §12 Out still excludes the focus view (`prd.md:236`, future `prd.md:250`) and is now consistent with FR-031.
  - PD-020 (`prd.md:273`) is `Decided`, owner author, 2026-10-30, with the quote «Open the detail (Recommended)» (translated), and it links FR-031, J-003 and `review-flow.mmd`.
  - The traceability row `prd.md:283` maps CAP-004 to FR-025 and FR-031.
  - `review-flow.mmd:20-22` offers the concept's detail on a wrong answer.
  - No new API is needed: the detail is served by the existing `GET /api/concepts/{id}` (`openapi.yaml:37`).
- Routed to: —
- Accepted by: —

### F-004 — Recall question ids are declared "never reused", but no component can enforce it

- Severity: `MINOR`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/architecture.dsl` (with `docs/design/data/concept.schema.json`)
- Related requirements: BR-006, BR-007, FR-012, FR-016
- Evidence:
  - `concept.schema.json:61` says the id is "Never reused".
  - The capture server only reads and writes concept files and reads the facets (`architecture.dsl:36-37`). It never reads the review log, so it cannot tell which ids already have history.
  - Hand edits can remove a question (FR-016; `ADR-002-storage-format.md:46` only warns against editing ids).
- Why it matters: if a hand edit deletes `q2` and a later capture issues `q2` again, the new question inherits the old one's box and history. Its scheduling is then wrong without any visible error. The trigger is a rare edge case, which is why this is MINOR.
- Required resolution: state how id reuse is prevented (for example the capture server reads the log or a high-water mark for the concept), or record the limitation as an accepted risk.
- Verification evidence: still open after cycle 1 (not in the work set). The new contract narrows the case but does not close it. `capture-tools.schema.json:138` continues new ids "after the highest q-number in the stored file", so reuse now happens only when a hand edit deletes the highest-numbered question. That still meets neither resolution option.
- Routed to: —
- Accepted by: —

### F-005 — The rule for what counts as "today" is undefined: time zone and overdue questions

- Severity: `MINOR`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/domain.md` (with `docs/design/data/review-line.schema.json` and `docs/design/api/openapi.yaml`)
- Related requirements: FR-026, FR-028, FR-029, FR-030, BR-006
- Evidence:
  - The review log stores `at` as a date-time (`review-line.schema.json:11`), while `QuestionState.due` is a date (`openapi.yaml:145`).
  - FR-026 says "due on the current day" (`prd.md:165-166`) and `openapi.yaml:83` says "due today".
  - No artifact says which time zone sets the day boundary, or whether questions whose due date has passed without review are still listed.
- Why it matters: a UTC timestamp compared with a local date gives off-by-one due dates in the author's time zone. A literal "due == today" filter would drop missed questions forever. Each is a one-line fix, but implementations would behave differently.
- Required resolution: the domain states that days use the author's local time zone, and that the due list contains questions with due date ≤ today.
- Verification evidence: still open after cycle 1 (not in the work set). This is a partial step: `concept.schema.json:63` and `capture-tools.schema.json:120,138` define `confirmed` as the author's local calendar day. The domain still states no day-boundary rule for review `at` values, and no "due ≤ today" rule.
- Routed to: —
- Accepted by: —

### F-006 — No artifact says how the local server and the capture server find the same store folder

- Severity: `MINOR`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `DESIGN_GAP`
- Owner: `docs/design/architecture/architecture.dsl`
- Related requirements: FR-013, FR-015, FR-016
- Evidence:
  - The store folder is "chosen at plugin setup" (`architecture.dsl:56`).
  - The local server is "Started by the author's arch-mind command" (`architecture.dsl:50`).
  - No artifact names the shared configuration both processes read.
- Why it matters: if the two processes point at different folders, captures never appear in the app (FR-015, FR-016), with no error.
- Required resolution: name the single configuration source of the store path that both processes read.
- Verification evidence: still open after cycle 1 (not in the work set; no change touched it).
- Routed to: —
- Accepted by: —

### F-007 — PD-016 and PD-017 are still open; the design has a parameterized default for each

- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `OTHER`
- Owner: `docs/product/prd.md`
- Related requirements: FR-006, FR-028, FR-029
- Evidence:
  - PD-016 and PD-017 are Open (`prd.md:273-274`).
  - Box intervals are configuration (`facets.schema.json:5,12`) and the box count is drawn as an example (`domain.md:102`).
  - The facet catalog is read-only for capture (`architecture.dsl:25,37`).
- Why it matters: neither decision blocks build planning, because the design is parameterized. If PD-017 lets the author add facets during capture, the capture server needs write access to `facets.yaml`, and the build plan should not freeze that path first.
- Required resolution: none for approval. `writing-build-plan` should route FR-006 and FR-028 to FR-029 as dependent on these decisions.
- Verification evidence: still open after cycle 1. Inserting PD-020 moved the rows: PD-016 and PD-017 are now at `prd.md:274-275`, still `Open`. The new capture contract also reads facets only (`list_concepts` returns them, `capture-tools.schema.json:82-90`; `save_concept` rejects `unknown_facet`, `:119`), so the PD-017 dependency is unchanged.
- Routed to: —
- Accepted by: —

### F-008 — The OpenAPI file does not state that no credentials are required (Redocly recommended ruleset fails)

- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `EDITORIAL`
- Owner: `docs/design/api/openapi.yaml`
- Related requirements: NFR-005
- Evidence:
  - Redocly `security-defined` errors at `openapi.yaml:17,38,63,82,95` and an `info-license` warning at `openapi.yaml:2`.
  - The file is valid under the minimal ruleset.
  - ADR-005 deliberately uses no token (`ADR-005-local-server-exposure.md:29-30`).
- Why it matters: lint gates in the build fail, and the "no credentials" decision is implicit rather than declared in the contract.
- Required resolution: declare `security: []` at the root, or add a Redocly config that records this rule as intentionally off.
- Verification evidence: still open after cycle 1 (not in the work set; `openapi.yaml` unchanged).
- Routed to: —
- Accepted by: —

### F-009 — The OpenAPI `Concept` schema is untyped, and no 400 response is declared for invalid bodies

- Severity: `NOTE`
- Status: `OPEN`
- Origin: `BASELINE`
- Classification: `MINOR_INCONSISTENCY`
- Owner: `docs/design/api/openapi.yaml`
- Related requirements: FR-025, FR-032
- Evidence:
  - `components.schemas.Concept` is `type: object` with only a prose pointer to the data schema (`openapi.yaml:128-130`).
  - `POST /api/reviews` restricts `question` with a pattern and `additionalProperties: false` (`openapi.yaml:103-111`), but declares only 201, 403, 404 and 415 (`openapi.yaml:112-122`).
- Why it matters: contract tests generated from the OpenAPI file will not check the concept shape, and the response to a malformed body is unspecified. The behavior intended by the authorities is still clear, which is why this is a NOTE.
- Required resolution: `$ref` the data schema, or keep the pointer deliberately. Declare a 400 response for body validation failures.
- Verification evidence: still open after cycle 1 (not in the work set; `openapi.yaml` unchanged). Because the pointer resolves to `concept.schema.json`, the HTTP concept now also carries `recall[].confirmed`, with no conflict.
- Routed to: —
- Accepted by: —

## Cycle History

### Baseline — cycle 0

- BLOCKER open: `0`
- MAJOR open: `3`
- MINOR open: `3`
- NOTE open: `3`
- Verdict: `Needs design revision`

Checked with no finding:
- Authority integrity: one authority per concern, and both declared not-applicable artifacts are listed in the manifest.
- ADRs: all six are Accepted, each with an "Accepted by" quote and a stated reversibility. The one-way ADRs (002 and 004) cite their evidence. ADR-001 compares shapes that differ in mechanism, including reusing an existing platform (Obsidian), and gives the reason it was ruled out.
- Coverage: every NFR from NFR-001 to NFR-006 has a design response and a verification path. Each trust-boundary crossing has a threat with its mitigation or an accepted risk. Capacity estimates are present and labeled assumed. Every architecture rule has a check.
- Product: no non-goal is implemented by the architecture.
- Consistency: BR-001 to BR-007 match between the domain, the data schemas and the API.

### Reconciliation — cycle 1

- Date: 2026-10-30
- Work set: F-001, F-002, F-003 (all OPEN MAJOR). MINOR and NOTE findings left as design debt; the author did not ask to address them.
- Change set:
  - `docs/product/prd.md` — PD-020 added; FR-031, J-003 step 3 and the CAP-004 traceability row changed (authorized by PD-020).
  - `docs/design/ux/review-flow.mmd` — wrong-answer step.
  - `docs/design/data/concept.schema.json` — `recall[].confirmed` required; description points to the capture contract.
  - `docs/design/domain.md` — Recall Question invariant names the confirmation day.
  - `docs/design/architecture/quality-attributes.md` — replay rule starts from `confirmed`.
  - `docs/design/api/capture-tools.schema.json` — new capture tool contract.
  - `docs/design/architecture/architecture.dsl` — MCP tools component points to the contract.
  - `docs/spec/manifest.yaml` — `capture_api` authority; status `ready_for_verification`.
- Checks run after the change: `check-package.mjs` passed; `ajv compile --spec=draft2020` passed for the three data schemas; `ajv compile --spec=draft2020 --strict=false` passed for the capture contract (strict off because tool entries carry the non-schema keys `inputSchema`, `outputSchema`, `rejections`, `assigns`).
- Findings set to `READY_FOR_VERIFICATION`: F-001, F-002, F-003. None self-declared `RESOLVED`.

### Follow-up verification — after cycle 1

- Date: 2026-10-30
- Reconciliation change set: the eight paths listed under "Reconciliation — cycle 1", each read directly.
- Findings verified: F-001, F-002, F-003 (`READY_FOR_VERIFICATION` → `RESOLVED`); F-004 to F-009 re-checked against the change set and kept `OPEN`.
- New regressions: none
- Critical new blockers: none
- BLOCKER open: `0`
- MAJOR open: `0`
- MINOR open: `3`
- NOTE open: `3`
- Previous BLOCKER+MAJOR open: `3`
- Current BLOCKER+MAJOR open: `0`
- Consecutive increases: `0`
- Verdict: `Approved for build planning`

Impact cone checked with no regression:
- Capture contract against the PRD rules. FR-009, FR-010 and FR-011 map to `missing_source`, `missing_target` and `duplicate_id`. BR-003 is covered by the layer enum, FR-006 by `unknown_facet`, BR-005 by `incomplete_see_i` and `no_recall`, and FR-012 by additive `extend_concept` under the same relation shape and rules. The capture server's read-only facet access (`architecture.dsl:25,37`) is consistent with `list_concepts` returning facets.
- `confirmed` across authorities: data schema, domain invariant, replay rule and capture contract agree. The input schemas cannot carry it; the stored schema requires it. ADR-002 needs no edit under manifest rule 1.
- `get_concept` and `saveResult` output schemas are `$ref` roots to object schemas. The resulting shape is unambiguous, and how the server publishes it in `tools/list` is an implementation detail.
- `flows.mmd:11` still summarizes the `list_concepts` result as "ids, titles, layers", narrower than the contract. This is an editorial difference: the contract owns the detail (manifest rule 1), and `flows.mmd` was not in the change set.
- PD-020 settles FR-031 as product behavior. §12 Out, J-003 and `review-flow.mmd` agree, and the existing `GET /api/concepts/{id}` serves the detail.
- `capture_api` manifest key: accepted as a legitimate authority entry (see F-002 verification evidence); not a finding.

Next step: set `docs/spec/manifest.yaml` `status: approved`. OPEN MINOR and NOTE findings do not block; F-007 asks `writing-build-plan` to treat FR-006 and FR-028 to FR-029 as dependent on PD-016 and PD-017.
