# ADR-002 — Storage format and review history

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «A · md + log (Recommended)» (translated)
Related: CON-002, FR-014, FR-016, FR-017, FR-032, NFR-003, NFR-004, BR-006, BR-007
Reversibility: one-way — changing it means migrating every concept file and the review history.

## Context
CON-002 fixes Markdown for concepts. Open are the structure inside each file and where review history lives (`docs/discovery/findings.md` DQ-001, open item after challenge). Reviews happen about 20 times a day (assumed); BR-007 makes history append-only.

## Decision Drivers
- Concept files readable in a plain editor (FR-014, NFR-004).
- Hand edits picked up and broken files reported (FR-016, FR-017).
- History never rewritten; box and due date always consistent (BR-006, BR-007).
- No partial writes (NFR-003).
- Evidence: the DQ-006 probe wrote a concept as Markdown with YAML frontmatter (one concept; the YAML was not parsed back).

## Options Considered
### Option A — One Markdown file per concept with YAML frontmatter; review history in one append-only JSON Lines file
Frontmatter holds id, title, facets, relations (type, target, source, explanation), episodes and recall questions with stable ids; the body holds the SEE-I under four headings. Each review is one appended line (question id, date, result). Box and due date are computed by replaying the lines with the box intervals.
- Benefits: concept files change only when knowledge changes; append-only matches BR-007; no stored box/due that can drift from history.
- Costs/risks: replay on every load (cheap at about 7,300 lines a year, assumed); the log is readable but not pleasant to read by hand.

### Option B — Review state inside each concept's frontmatter
Each recall question keeps its box, due date and history in the concept file.
- Benefits: one file per concept holds everything.
- Costs/risks: every review rewrites a concept file, mixing study noise into knowledge files and their Git history; a crash mid-write risks the concept itself.

### Option C — Markdown for concepts, SQLite for reviews
- Benefits: queries and transactions for free.
- Costs/risks: a binary file not readable without a tool; a native dependency.

### Option D — Everything in a database with Markdown export
- Ruled out by: CON-002 (concepts are stored as Markdown files).

## Decision
Option A. Writes go to a temporary file in the same folder and are renamed into place; review lines are appended whole.

## Consequences
### Positive
- Knowledge files stay clean and diffable; history cannot be rewritten by the app.

### Negative / Trade-offs
- Editing a recall question's id by hand would orphan its history; ids are written by capture and documented as not to be edited.

## Verification / Revisit Trigger
- A test round-trips a concept file through write and parse with no field lost.
- Revisit if replay exceeds NFR-006's target.
