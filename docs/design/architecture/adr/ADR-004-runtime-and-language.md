# ADR-004 — Runtime and language

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «So yes, Node.js + React» (translated)
Related: CON-001, BR-001, BR-002, BR-003, BR-004, BR-005
Reversibility: one-way — another language means rewriting the rules module and both servers.

## Context
ADR-001 needs one rules module used by the local server and the capture server, and a browser UI.

## Decision Drivers
- One rules module for both servers (ADR-001).
- The author's existing stack: Node 24, React 19 with Vite in TrainLog and myRespository (`docs/discovery/findings.md`, audit).
- The probe server ran on Node 24 with no dependencies (DQ-006).

## Options Considered
### Option A — TypeScript on Node.js for rules, local server and capture server; React with Vite for the UI
- Benefits: one language end to end; the rules module can also be imported by the UI for instant feedback; matches the author's stack; an official MCP TypeScript SDK exists (Hypothesis, not checked this session).
- Costs/risks: none specific beyond the usual Node dependency hygiene.

### Option B — Python for rules and servers, TypeScript UI
- Benefits: the author also uses Python (Polyquack).
- Costs/risks: two languages; rules cannot be shared with the UI.

### Option C — Go for servers, TypeScript UI
- Costs/risks: a language new to the author's projects; rules cannot be shared with the UI.

### Option D — Rust for rules and servers, TypeScript UI
Raised by the author («could we try Rust? I've heard a lot about it but I don't really know it», translated).
- Benefits: compiled to one fast binary; memory safety enforced by the compiler; the rules could also be compiled to WebAssembly and shared with the UI (Hypothesis, not probed); an MCP Rust SDK exists (Hypothesis, not checked this session).
- Costs/risks: new to the author, with a steep learning curve (ownership and borrowing rules); performance gains are irrelevant at this load (about 300 concepts a year, assumed); the UI and elkjs stay in TypeScript, so the project has two languages; sharing rules with the UI through WebAssembly adds a build step.

## Decision
Option A: TypeScript on Node.js for the rules module, the local server and the capture server; React with Vite for the UI.

## Consequences
### Positive
- Rules written once; types shared between UI, server and capture.

### Negative / Trade-offs
- Ties the project to the Node ecosystem.

## Verification / Revisit Trigger
- Revisit only if a required library exists solely outside Node.
