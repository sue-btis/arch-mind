# ADR-005 — Local server exposure

Status: Accepted
Date: 2026-10-30
Decision owners: author
Accepted by: author, 2026-10-30, «A · Loopback + Host/Origin (Recommended)» (translated)
Related: NFR-005, CON-005, FR-032, BR-007
Reversibility: two-way — the checks live in one middleware; changing them is local to the server.

## Context
ADR-001 opens a port on the author's computer. Two risks: another device on the network reaching it, and a web page in the author's browser sending it requests (cross-site requests, or DNS rebinding, where a hostile domain is made to resolve to 127.0.0.1). The MCP specification requires servers listening over HTTP locally to validate Origin and bind to localhost for this reason (`docs/discovery/findings.md` S-603); applying the same rules here is an inference.

## Decision Drivers
- No other device may connect (NFR-005).
- A web page must not record reviews or read concepts (BR-007).

## Options Considered
### Option A — Bind to 127.0.0.1, accept only Host values for localhost on its port, reject any request whose Origin is not the app's own, send no CORS headers, accept only JSON bodies
- Benefits: blocks other devices (loopback only), DNS rebinding (Host check) and cross-site writes (Origin check and JSON-only bodies); no secret to manage.
- Costs/risks: another program running as the author could still call it; accepted, since such a program can already read the files.

### Option B — Option A plus a random token generated at start and required on every request
- Benefits: also blocks other local programs that lack the token.
- Costs/risks: a token to carry in the URL or a cookie; little gain on a single-user computer where files are already readable.

### Option C — Bind to all interfaces with a password
- Ruled out by: CON-005 and NFR-005 (the author: «Only your computer»).

## Decision
Option A: loopback bind, Host and Origin checks, no CORS headers, JSON-only bodies.

## Consequences
### Positive
- Simple, testable checks in one place.

### Negative / Trade-offs
- Does not defend against other local programs (accepted risk above).

## Verification / Revisit Trigger
- Tests send requests with a foreign Host and a foreign Origin and expect rejection.
- NFR-005 acceptance from another device.
- Revisit if phone access is ever decided.
