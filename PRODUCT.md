# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
React with Vite and TypeScript (`docs/design/architecture/adr/ADR-004-runtime-and-language.md`), Tailwind CSS v4 and the shadcn CLI, with components from Watermelon UI (MIT; installed from `https://registry.watermelon.sh/r/<component>.json`; requires React 18+ and Tailwind v4; Vite + React is its recommended setup). The layer view is laid out by elkjs and drawn by React Flow (`ADR-006-layer-view-layout.md`). Confirmed by the author on 2026-10-30. Recorded in the design package as ADR-007 (`docs/design/architecture/adr/ADR-007-ui-foundation.md`), change folder `docs/changes/2026-10-30-ui-foundation-adr/`.

## Users
One person: the author, a developer learning web and software architecture, who works daily with Claude Code. Concepts come up during real project work; the author studies and reviews them later at their own computer, in a desktop browser.

## Product Purpose
arch-mind turns architecture answers that would otherwise stay in chat transcripts into knowledge the author keeps. The author captures a concept from inside a Claude Code session, studies it in small views that show how it relates to other concepts across system layers, and reviews it with recall questions on a Leitner schedule. Success: weeks later the author can explain a concept and its relations from memory (`docs/product/prd.md` SC-001 to SC-003).

## Positioning
The author builds the map. Claude proposes relations, a SEE-I draft and recall questions, but nothing is saved unless the author selects, explains, accepts or rewrites it, and every relation carries its source. Research found that building a map helps retention more than studying a finished one (`docs/discovery/findings.md` DQ-003). Knowledge lives as plain Markdown files the author owns.

## Operating Context
- Capture: a Claude Code plugin with a local MCP server, used inside sessions in any of the author's repositories, working whether or not the app is open.
- Study and review: a local web app started by an `arch-mind` command, on the author's own computer only; no other device can connect.
- Store: one Markdown file per concept plus an append-only review log, in a folder the author backs up.
- Reference screen: a 1366 × 768 desktop browser window at 100 % zoom; every view must fit its width.

## Capabilities and Constraints
- Capture with author-built relations (type, target, source, the author's one-sentence explanation), SEE-I (statement, elaboration, example, illustration), facets (one layer; domains; concerns), episode and recall questions.
- Layer view (layers stacked as bands: client, network, server, data) and matrix view over facet filters; sources and explanations on hover; concept detail.
- Daily Leitner review that hides the answer until the author tries to recall it; after a wrong answer, the app offers the concept's detail.
- Concept content is written in English.
- Out of the MVP: phone or network access, a concept-and-neighbors focus view, adaptive scheduling (FSRS), editing concepts inside the app, search.
- Undecided: Leitner box count and intervals (PRD PD-016); who maintains the domain and concern lists (PRD PD-017).
- Product authority: `docs/product/prd.md`; design authority index: `docs/spec/manifest.yaml`.

## Brand Commitments
- Name: arch-mind.
- The layer view has arch-mind's own design with layers as stacked bands; generic diagram styling is not acceptable for it (PRD UX-001).

## Evidence on Hand
- The TST-032 concept chain (13 concepts, 15 relations about `__Host-` cookies, Secure contexts, upgrade-insecure-requests, HSTS, Lighthouse) in `docs/discovery/spikes/DQ-005-view-layouts/index.html`, used as the acceptance fixture for view width.
- A sample concept file shape from the capture probe in `docs/discovery/spikes/DQ-006-mcp-capture/`.
- No real captured concepts yet. No testimonials, users or metrics exist; do not invent them.

## Product Principles
1. The author builds the knowledge; Claude only proposes.
2. Every relation can be traced to its source.
3. Recall before reveal: the answer is never shown before the author tries to remember it.
4. Views stay small enough to read at a glance; a view that would not fit is narrowed, not scrolled sideways.
5. The knowledge outlives the app: plain files, readable without arch-mind.

## Accessibility & Inclusion
WCAG 2.2 AA as the baseline (author, 2026-10-30): contrast, full keyboard operation and visible focus, including in the layer and matrix views and the review screen.
