# arch-mind Product Brief

Design size: standard

## Problem
The author is learning software architecture from two sources: videos and the design questions Claude raises while working on real projects (for example, why WebKit rejects `Secure`/`__Host-` cookies over `http://*.localhost`, and how that breaks production-mode Lighthouse runs). Each answer is understood in the moment and forgotten later, because it stays isolated in a chat transcript. Nothing connects a new concept to the ones already learned, or to the project decision where it came up, and nothing brings it back for review.

## Target Users and Context
- Primary user: the author, a single developer learning web and software architecture.
- Secondary users: none in the MVP.
- Usage context: capture happens inside Claude Code sessions while working on projects, right when a concept comes up. Study and review happen in a dedicated web app, where the author explores focused views and answers recall questions.

## Desired Outcomes
- OUT-001 — A concept that comes up in a Claude Code session can be captured without leaving the session, linked to existing concepts and to the project episode where it appeared.
- OUT-002 — The author can open a focused view (one domain, one layer, or a domain × layer slice) small enough to hold in mind, and see how its concepts relate, including relations that cross layers.
- OUT-003 — The author can explain a captured concept and its relations from memory weeks after capturing it, supported by recall questions the app schedules.
- OUT-004 — Every relation shown can be traced to its source (official documentation, specification, or the project episode), so the map does not teach false connections.

## Scope
Included:
- Capture of concepts, typed relations, sources, project episodes, and recall questions through the product's own Claude Code skills.
- A web app with a custom visual design (not generic diagram rendering) that shows focused views by domain, by layer, and by domain × layer.
- Simple review mode: recall questions per concept, prioritizing concepts that are least recently or least successfully reviewed.
- One shared store of concepts: a concept exists once and appears in every view it belongs to.

Excluded:
- Multiple users, accounts, sharing, or collaboration.
- A single global graph of everything as the primary way to explore.
- Automatic extraction of concepts from code or transcripts without the author's confirmation.
- Mobile apps.
- Importing or syncing with Obsidian, Anki, or other tools.

## Constraints
- CON-001 — The product is a web app with its own skills for capture; Mermaid-style generic diagrams are not enough for the intended visual design.
- CON-002 — Review (recall questions) is part of the MVP.
- CON-003 — Repository artifacts (code, docs, file names) are written in English.
- CON-004 — Capture must work from Claude Code, where the concepts come up.

## Core Domain Language
| Term | Meaning |
|---|---|
| Concept | One unit of architecture knowledge (for example, "`__Host-` cookie prefix"). Exists once in the store. |
| Relation | A typed, directed link between two concepts (for example, *requires*, *causes*, *alternative to*, *trade-off with*). |
| Source | Evidence that backs a concept or relation: official documentation, a specification, or an episode. |
| Episode | A real situation in a project where a concept came up, with the decision taken (for example, TST-032 in a web project). |
| Domain | A subject area that groups concepts (for example, web, mobile, models). The final list comes from discovery. |
| Layer | A part of a system a concept belongs to (for example, client, network, server, data). The final taxonomy comes from discovery. |
| View | A focused subset of concepts selected by domain, layer, or both, shown with their relations. Not a copy of concepts. |
| Recall question | A question about a concept that the author answers from memory during review. |
| Review | One attempt at a recall question, with its outcome, used to decide what to ask next. |

## Approved Product Decisions
- The product is a web app with its own capture skills, so the visual design can be unique (author, 2026-10-29).
- Simple review with recall questions is in the MVP (author, 2026-10-29).
- The domain and layer taxonomy is chosen after discovery compares existing taxonomies (author, 2026-10-29).
- The project is named `arch-mind` (author, 2026-10-29).
- Build arch-mind instead of adopting a tool; Obsidian was reviewed and rejected (author, 2026-10-30). Concepts are stored as Markdown files readable without the app — `docs/discovery/findings.md` DQ-001.
- Views filter concepts by facets: layer, domains, concerns — DQ-002.
- At capture, Claude proposes relations with sources; the author chooses and explains each, and writes each concept as SEE-I (State, Elaborate, Exemplify, Illustrate) — DQ-003.
- Review starts with Leitner boxes; review history is kept — DQ-004.
- Two views: a layer view that fits one screen for following chains, and a matrix for checking all relations — DQ-005.
- A relation without a source is rejected at capture — DQ-006.
(All 2026-10-30 decisions: author, «Accept all».)

## Open Product Decisions
- Hosting: local only on the author's machine, or reachable from a phone for review. Authority: author. It changes platform, security, and data constraints.
- Concept content language: concepts and recall questions in Spanish (the author's study language) or English like the repository. Authority: author. It changes capture prompts and the content of the store.
- Sixth must criterion (CR-006): selected during discovery but never stated. Authority: author. It may add a requirement.
- "Reads at a glance": what makes a view readable (for example, no horizontal scroll at 1366 px, sources readable without hover, a node limit). Authority: author. Discovery found no evidence for a node limit (DQ-003). It sets the acceptance test for views.

## Discovery
Depth: deep
Findings: `docs/discovery/findings.md` (once discovery runs)

Kill criterion: if an existing tool already provides capture from Claude Code, domain × layer views, and scheduled recall at the quality the author wants, adopt or extend it instead of building arch-mind.

| ID | Evidence question | Unblocks |
|---|---|---|
| DQ-001 | Which existing tools (for example, Obsidian with plugins, Logseq, RemNote, Heptabase, Anki, concept-mapping tools) already combine typed relations, focused views, and spaced recall, and where do they fall short for this use? | Build vs adopt (kill criterion) |
| DQ-002 | Which domain and layer taxonomies (network layers, C4, client/network/server/data, others) best organize web and software architecture concepts for a learner, and how do concepts that span layers fit? | Taxonomy decision; View definition |
| DQ-003 | What does learning research say about concept maps, chunk size, and retrieval practice: does studying focused views improve understanding, and how many nodes per view stay readable? | View size limit; OUT-002 and OUT-003 targets |
| DQ-004 | Which review scheduling methods (Leitner boxes, SM-2, FSRS) fit a small personal set of concepts with simple self-graded answers, and what is the simplest one that works? | Review behavior in the PRD |
| DQ-005 | Which visual approaches for layered relation graphs (hand-designed layered layouts, force-directed, swimlanes by layer, matrix views) keep cross-layer relations readable, measured on a sample of real concepts? | Visual design direction; HTML prototype scope |
| DQ-006 | How can a Claude Code skill write to the app's store safely (direct files, local API, or other), and what does the author need to confirm before a capture is saved? | Capture flow; contract artifacts |

## Artifact Applicability
| Artifact | Required? | Reason |
|---|---:|---|
| PRD | Yes | Product authority |
| Domain model | Yes | Concept, Relation, View, and Review need stable meaning and invariants (a concept exists once; views are selections) |
| Structurizr DSL | Yes | Web app, capture skills, and the store are separate parts whose boundaries matter |
| ADR | Yes | Inputs from `docs/discovery/findings.md`: Markdown storage format and where review history lives, MCP capture path, rendering engine, scheduler swap path |
| DBML | Yes | Concepts, relations, sources, episodes, and review history are persistent structured data |
| OpenAPI | No | Capture uses a local stdio MCP server, not an HTTP API (DQ-006); its tool schema is the contract and lives with the design |
| AsyncAPI | No | No asynchronous or event contracts expected |
| Mermaid flows | Yes | Capture flow and review flow cross the skill, the store, and the app |
| HTML prototype | Yes | The visual design of views is the core value and must be validated before building |
| Quality attributes | Yes | View readability, data durability of the knowledge store, and local privacy need a design response and verification |
