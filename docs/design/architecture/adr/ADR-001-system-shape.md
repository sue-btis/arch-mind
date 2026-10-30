# ADR-001 — System shape

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «A · Local server (Recommended)» (translated)
Related: CON-001, CON-002, CON-005, FR-013, FR-016, NFR-001, NFR-004, NFR-005
Reversibility: two-way — the concept files and the capture server stay; moving to another shape means rewriting the local server or the shell around the UI, not the data.

## Context
arch-mind must capture concepts from Claude Code even when the app is closed, keep them as Markdown files readable without the app, draw custom views in a browser and run reviews, all on the author's computer only. The expected load is tiny (about 300 concepts and 7,300 reviews a year, assumed; see `../quality-attributes.md`), so the shape is decided by where state lives and who writes the files, not by performance.

## Decision Drivers
- Concepts are Markdown files readable without the app (CON-002, NFR-004).
- Capture works with the app closed (FR-013).
- The same rules (BR-001 to BR-005) apply wherever concepts are written, including hand edits (FR-017).
- Runs only on the author's computer and answers no other device (CON-005, NFR-005; author: «Only your computer»).
- A web app with its own capture skills (CON-001; author: «a web app with its own skills»).
- Building it should teach architecture (discovery criterion CR-005, author: «I learn by building it»).

## Options Considered
### Option A — Local server + browser
A command starts a small server on the author's computer that reads and writes the concept files and the review history and serves the UI to the browser. Capture runs as a separate MCP server. Both use one shared rules module.
- Benefits: works in any browser; one rules module for capture, app and hand-edit checks; the common client-server pattern.
- Costs/risks: opens a local port, which must reject requests from web pages and other devices (ADR-005); two processes.

### Option B — Browser only
A page with no server opens the concept folder through the browser's File System Access permission and writes review history there.
- Benefits: no port at all; fewest moving parts.
- Costs/risks: the permission exists only in Chromium browsers and may be asked again each session (Hypothesis, not verified); rules would run in the browser and again in the capture server.

### Option C — Desktop shell
The same web UI inside a desktop window (Tauri or Electron) with native file access.
- Benefits: no port; native, safe file writes.
- Costs/risks: packaging and installing; Electron is heavy and Tauri needs Rust (Hypothesis); may not count as a "web app" under CON-001.

### Option D — Obsidian plugin
Views and review built as a plugin inside Obsidian.
- Ruled out by: the author, «I reviewed Obsidian, but it does not reach what I actually want» (`docs/discovery/findings.md` DQ-001).

## Decision
Option A: a local server serving a browser UI, a separate stdio capture server, and one rules module shared by both.

## Consequences
### Positive
- One place enforces BR-001 to BR-005.
- Any browser works; phone access later would mean exposing the same server, a product decision for later (NG-002).

### Negative / Trade-offs
- A listening port must be defended against web pages and other devices (ADR-005).
- The author starts the server before studying.

## Verification / Revisit Trigger
- The first milestone captures a concept with the app closed, then shows it in the layer view after starting the server.
- Revisit if the author decides on phone access or if defending the local port proves unreliable.
