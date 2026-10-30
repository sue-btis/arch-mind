# ADR-003 — Capture path from Claude Code

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «Accept all» (recorded in `docs/discovery/findings.md` DQ-006)
Related: CAP-001, FR-001, FR-009 to FR-013, NFR-002, NFR-005, BR-004
Reversibility: two-way — the rules module and file format stay; another path means replacing the plugin's server.

## Context
Captures start in Claude Code sessions in other repositories and must work with the app closed. Discovery compared six paths and probed one (`docs/discovery/findings.md` DQ-006).

## Decision Drivers
- Works with the app closed (FR-013).
- Rejects a relation without a source, a missing target, a duplicate id (FR-009 to FR-011).
- No network listener for capture (NFR-005).
- Little friction in the session (NFR-002).

## Options Considered
### Option A — Skill edits files directly
- Costs/risks: no validation before writing. Ruled out by: evidence, it cannot enforce FR-009 to FR-011 before saving (DQ-006).

### Option B — Local HTTP API of the running app
- Ruled out by: FR-013, it fails when the app is closed (DQ-006, Confirmed).

### Option C — Plugin bundling the capture skill and a local stdio MCP server
- Benefits: validates before writing; works with the app closed; no network port. Probe: rejected a relation without a source and a duplicate, wrote a readable file (DQ-006).
- Costs/risks: whether Claude Code prompts before each tool call is not yet verified; runs with the author's file rights.

### Option D — Inbox accepted inside the app; Option E — command-line tool; Option F — file writes checked by a hook
- Costs/risks: D adds a second step outside the session; E and F are untested.

## Decision
Option C. The skill guides Claude to propose and the author to confirm in the conversation; the MCP server's tools read existing concepts for proposals and save or extend concepts through the shared rules module. The input shape is the concept schema in `../../data/`.

## Consequences
### Positive
- One validation path for every capture.

### Negative / Trade-offs
- Plugin installation is a one-time setup step.

## Verification / Revisit Trigger
- Interactive check: whether `save_concept` asks for permission by default (open in DQ-006).
- NFR-002 measured on 5 real captures.
