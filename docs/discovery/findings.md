# arch-mind Discovery Findings

Depth: deep

Evidence labels: **Confirmed** (a primary source fetched during discovery states it), **Hypothesis** (inferred, from memory, or not fetched), **Ask** (only the author knows), **Problem** (broken or contradictory evidence).

## Comparison Criteria
| ID | Criterion | Must? | Agreed by |
|---|---|---:|---|
| CR-001 | Helps remember: weeks later the author can explain the concept from memory, not only recognize it | Yes | author, 29 Oct 2026, «Helps remember» (translated) |
| CR-002 | Own, readable views: each view reads at a glance and has the author's own design, not a generic tool's | Yes | author, 29 Oct 2026, «Own, readable views» (translated) |
| CR-003 | Frictionless capture: a concept is saved from Claude Code, in the same session, in under a minute | Yes | author, 29 Oct 2026, «Frictionless capture» (translated) |
| CR-004 | Relations with a source: every relation says where it comes from (docs, spec, or project episode) | Yes | author, 29 Oct 2026, «Relations with a source» (translated) |
| CR-005 | Learn by building it: building the product teaches architecture and serves as a portfolio piece | No | author, 29 Oct 2026, «I learn by building it» (translated) |
| CR-006 | None: the author confirmed there is no sixth must | — | author, 30 Oct 2026, «There is no sixth» (translated); see `docs/product/prd.md` PD-014 |

## Audit (applies to all questions)
- The author already has an Obsidian vault at `Documents/myVault/myVault` — `%APPDATA%/obsidian/obsidian.json`.
- Node v24.14.0, npm 11.9.0, and git 2.53 are installed (`node --version`, run 29 Oct 2026).
- The author's recent web projects use React 19 + Vite: `TrainLog/package.json` (react 19.2.8, vite 8.2.1) and `myRespository/package.json`.
- The author's plugin `explaining-skills` already has a `diagramas` skill with an HTML template and an SVG/PNG export script — `~/.claude/plugins/cache/changesmith/explaining-skills/0.2.0/skills/diagramas/`. It is a visual style reference, not a graph engine.
- The author's Claude memory system already links notes with `[[name]]` — `~/.claude/projects/.../memory/MEMORY.md`.
- First real concept chain for probes: the WebKit `__Host-` cookie / `upgrade-insecure-requests` / production Lighthouse question (TST-032) from a web project.

## DQ-001 — Does an existing tool already do this?

Unblocks: build vs adopt.
Kill or change criterion: an existing tool provides capture from Claude Code, typed relations with sources, focused domain × layer views with own design, and scheduled recall → adopt it instead of building.

### Options
| ID | Option | Mechanism | Origin | Evidence | Label |
|---|---|---|---|---|---|
| OP-101 | Obsidian + Breadcrumbs (typed edges) + Juggl (styled small graphs) + Spaced Repetition (FSRS/SM-2); Claude writes Markdown | Plugin stack over local Markdown | research | [S-101][S-102][S-103] | Screened out: the author reviewed Obsidian and it fails CR-002 for them (see Ideation) |
| OP-102 | Plain Markdown concepts + Anki for recall (Anki MCP via AnkiConnect) | Split store: files for knowledge, Anki for review | research | [S-104][S-105] | Confirmed Anki FSRS and MCP; views would still need a renderer (fails CR-002 alone) |
| OP-103 | Build arch-mind: own web app + own capture skills | Custom store, renderer, scheduler | author | brief | Hypothesis: highest fit, highest effort |
| OP-104 | Hybrid: concept Markdown files as the store (also readable in Obsidian), own web app only for views and review | Open file format + custom front end | session, endorsed by author | DQ-006 probe | Confirmed that one concept with typed, sourced relations fits in Markdown frontmatter (probe); app side Hypothesis |
| OP-105 | Do nothing: answers stay in chat transcripts | None | baseline | — | Fails CR-001..CR-004 |
| OP-106 | Other tools surveyed: Logseq, RemNote, Heptabase, Tana, Kumu, CmapTools, TheBrain | Various | research | [S-106][S-107] | Mostly Hypothesis (fetches failed); none found with all four musts |

### Ideation
- The author reviewed Obsidian and rejected it (screened by preference, not tested): «I reviewed Obsidian, but it does not reach what I actually want» (author, 30 Oct 2026, translated). OP-101 is out; no Obsidian probe is needed.
- The author endorsed the hybrid: «The duality could work: using .md as the base gives a lot of compatibility with modern systems, given the rise of .md» (author, 30 Oct 2026, translated). OP-104 becomes the leading option; the storage format is ADR input for `designing-system`.

Kill criterion status: **not hit** (Hypothesis, moderate confidence). No surveyed tool covers all four. The closest, OP-101, has unverified gaps on per-relation sources and layer-filtered views.

### Probes
| Option | Setup | Measured | Result against the criterion |
|---|---|---|---|
| OP-101 | Not run | — | Cancelled: the author screened OP-101 out after reviewing Obsidian |

### Decision
Status: Decided
Decision: OP-104 hybrid: build arch-mind; concepts live as Markdown files with YAML frontmatter, readable without the app; the app reads them for views and review.
Decided by: author, 30 Oct 2026, «Accept all» (accepting the recommendation in chapter 8 of `docs/discovery/arch-mind-discovery.html`)
Route: brief decision (build); storage format is ADR input

## DQ-002 — Which domain and layer taxonomy?

Unblocks: View definition; taxonomy decision.
Change criterion: if no taxonomy places cross-cutting concepts (security, caching) without forcing a single parent, views must be built from relations instead of categories.

### Options
| ID | Option | Mechanism | Origin | Evidence | Label |
|---|---|---|---|---|---|
| OP-201 | OSI / TCP-IP network layers | Protocol stack | research | RFC 1122, ISO 7498 (not fetched) | Hypothesis: good for networking, nothing above the application layer |
| OP-202 | C4 levels (context, container, component, code) | Zoom level of a system | research | c4model.com (not fetched) | Hypothesis: a zoom axis, cannot place "HSTS" |
| OP-203 | Tiers: client / network / server / data | Where it runs | research | common practice | Hypothesis: intuitive; security and CDN straddle tiers |
| OP-204 | Request-lifecycle stages (browser → DNS → TLS → CDN → server → DB) | Order of a request | adjacent field (teaching "what happens when you type a URL") | — | Hypothesis: good study order; no place for design principles |
| OP-205 | Quality attributes (ISO/IEC 25010: security, performance, reliability…) | Concern | research | ISO/IEC 25010 (not fetched) | Hypothesis: captures cross-cutting concerns, not location |
| OP-206 | Faceted classification: independent facets layer (tier) + domain + concern | Several independent axes, no single parent | adjacent field (library science, Ranganathan) | — | Hypothesis: best fit if kept to 2–3 facets |

### Decision
Status: Decided
Decision: OP-206 faceted classification: each concept carries a layer (client / network / server / data), domains and concerns; a view is a filter over facets.
Decided by: author, 30 Oct 2026, «Accept all» (accepting the recommendation in chapter 8 of `docs/discovery/arch-mind-discovery.html`)
Route: brief decision

## DQ-003 — What does learning research say about maps, view size, and recall?

Unblocks: view size limit; OUT-002 and OUT-003 targets; who builds the relations at capture.
Change criterion: if studying ready-made maps barely helps, capture must make the author construct relations, not just accept Claude's.

### Options
| ID | Option | Mechanism | Origin | Evidence | Label |
|---|---|---|---|---|---|
| OP-301 | The learner builds the map (author writes or chooses each relation) | Generation effect | research | [S-302] g=0.72 for creating maps; g≈0.82 attributed to [S-301] by S-302 (the S-301 abstract gives 55 studies and 67 effect sizes, no split) | Confirmed only via a secondary snippet; the S-302 page was blocked |
| OP-302 | The learner studies a ready-made view (Claude proposes the relations) | Studying an expert map | research | [S-302] g=0.43 | Same caveat. 0.72 and 0.43 are each measured against their own control groups, so they are not a head-to-head test. No study covers accepting AI-proposed relations: Hypothesis |
| OP-303 | Scheduled recall questions as the main review | Retrieval practice | research | [S-303] retrieval practice beat elaborative concept mapping, also on inference questions and on a concept-map final test | Confirmed direction (abstract). The study does not test spacing; spacing evidence (Cepeda) not fetched: Hypothesis |
| OP-304 | Explain-back: the author writes the relation in their own words before Claude checks it | Self-explanation | challenge | — | Not researched: Hypothesis |
| OP-305 | SEE-I for each concept: State it, Elaborate it, give an Example, Illustrate it with an analogy or picture; the author writes each part | Structured self-explanation template | user («when explaining concepts I found the SEE-I method useful», author, 30 Oct 2026, translated) | Paul & Elder, Foundation for Critical Thinking (not fetched) | Hypothesis: origin and effectiveness not verified; the author reports it works for them. Gives each concept file a fixed body shape and a natural source for recall questions (one per part) |

View size: **no study found** that sets a node limit for node-link diagrams (Problem: evidence gap). Working memory of about 4±1 chunks (Cowan 2001) is Hypothesis, not fetched. A cap of 7–15 nodes would be a design choice, not evidence.

### Decision
Status: Decided
Decision: Claude proposes relations with sources; the author chooses each one and explains it in their own words (OP-304), and writes the concept body as SEE-I (OP-305). Recall questions come from the author's explanations.
Decided by: author, 30 Oct 2026, «Accept all» (accepting the recommendation in chapter 8 of `docs/discovery/arch-mind-discovery.html`)
Route: brief decision

## DQ-004 — Which review scheduler?

Unblocks: review behavior in the PRD.

### Options
| ID | Option | Mechanism | Origin | Evidence | Label |
|---|---|---|---|---|---|
| OP-401 | Leitner boxes | Correct → next box; miss → box 1 | research | — | Hypothesis (mechanism from memory); trivial to hand-write |
| OP-402 | Fixed expanding intervals (1, 3, 7, 16, 35 days) | Step index; miss resets | research | — | Hypothesis; trivial |
| OP-403 | SM-2 | Ease factor scales next interval | research | — | Hypothesis; no benchmark number found vs FSRS |
| OP-404 | FSRS (ts-fsrs, MIT) | Stability/difficulty memory model, targets a retention rate | research | [S-401][S-402] | Confirmed that FSRS-6 beats a constant-retention baseline (log loss 0.346 vs 0.395) without same-day reviews; with same-day reviews it scores 0.384 vs 0.382, slightly worse. The baseline is not SM-2; no FSRS vs SM-2 number found. Running on defaults for 50–300 concepts is Hypothesis |
| OP-405 | No scheduler: recall questions on demand | The author picks what to review | challenge | — | Baseline; Hypothesis: weaker than spacing |

### Decision
Status: Decided
Decision: OP-401 Leitner boxes for the first version; keep review history so FSRS (OP-404) can replace it later.
Decided by: author, 30 Oct 2026, «Accept all» (accepting the recommendation in chapter 8 of `docs/discovery/arch-mind-discovery.html`)
Route: brief decision; scheduler swap is ADR input

## DQ-005 — Which visual approach keeps cross-layer relations readable?

Unblocks: visual design direction; HTML prototype scope.

### Options
| ID | Option | Mechanism | Origin | Evidence | Label |
|---|---|---|---|---|---|
| OP-501 | Automatic layered layout (ELK layered, dagre) | Sugiyama: layers that minimize crossings | research | [S-501][S-502] | Confirmed libraries maintained (elkjs 0.12.1, 28 Oct 2026; dagre 2.0.0, 23 Nov 2025) |
| OP-502 | Layer-ordered column groups (ELK partitioning) | Groups placed left to right by partition index; not true lanes | research | [S-503] `elk.partitioning.activate` | Confirmed option exists; "swimlanes" is our reading, not the doc's |
| OP-503 | Force-directed (d3-force, Cytoscape fcose) | Physics simulation | research | [S-504] | Hypothesis: loses layer grouping, unstable between runs |
| OP-504 | Adjacency matrix | Grid rows × columns, no crossings | research | Ghoniem et al. 2005 (not fetched) | Hypothesis: weak for following a chain |
| OP-505 | Hand-placed lanes: author or rules place each concept in a fixed lane position | Curated layout, stable | session | — | Hypothesis: full control, effort per concept |
| OP-507 | Lane-constrained solver: fixed lane per concept, the solver orders within the lane and routes edges | Constraints + automatic routing | challenge | — | Hypothesis; would remove the probe's hand-placement and routing confound |
| OP-508 | Focus + context: start at one concept and show N hops outward | Neighborhood view instead of category view | challenge | — | Hypothesis |
| OP-509 | Static render: precompute one SVG per view | Build-time layout | challenge | — | Hypothesis |
| OP-506 | Mermaid diagrams | Generic text-to-diagram | author (earlier) | — | Screened out: author said it does not reach CR-002 |

Readability research: edge crossings hurt comprehension most (Purchase 1997/2002) — Hypothesis, not fetched.

### Probes
| Option | Setup | Measured | Result against the criterion |
|---|---|---|---|
| OP-502 | `docs/discovery/spikes/DQ-005-view-layouts/` tab A, elkjs 0.9.3, 13 concepts, 15 relations, orthogonal routing | Crossing pairs counted from drawn geometry; drawing size | 0 crossing pairs (proxy); 1954 × 348 px, wider than one laptop screen, needs horizontal scroll (fails "at a glance" unless lanes stack vertically) |
| OP-501 | Same file, tab B, no partitions | Same | 0 crossing pairs (proxy); 1474 × 318 px; layers mixed inside columns, layer only visible by color |
| OP-505 | Same file, tab C, positions hand-set once by the probe author in 3 horizontal lanes | Same | 5 crossing pairs, but with straight lines instead of orthogonal routing, so not comparable with A and B; 980 × 430 px (fixed by the probe's constants); layers read as rows |
| OP-504 | Same file, tab D | Crossings by construction; chain readability | 0 crossings; following the chain means jumping between rows and columns |
| All | Author judgment against CR-002 | Which view reads best | A (layer-ordered column groups) and D (matrix) — «A and D seem useful» (author, 30 Oct 2026). B and C not chosen. Open: A is wider than one screen, so "at a glance" is still undefined; the two may serve different jobs (A for following a chain, D for checking all relations at once): Hypothesis |

Measurement limits: crossing pairs are a proxy for readability, not a measure of CR-002. They ignore bends, edge–node overlaps, label collisions and collinear overlaps, and skip pairs that share a concept. One view of 13 concepts is a single sample. The probe loads elkjs 0.9.3, not the current 0.12.1. Relation sources were corrected after the challenge; several remain "not fetched". CR-002's "at a glance" is not defined yet (Ask: for example, no horizontal scroll at 1366 px and the source readable without hover).

### Decision
Status: Decided
Decision: Two views: A (layer-ordered, reworked so layers stack as rows and fit one screen) for following chains, and D (adjacency matrix) for checking all relations.
Decided by: author, 30 Oct 2026, «Accept all» (accepting the recommendation in chapter 8 of `docs/discovery/arch-mind-discovery.html`)
Route: brief decision; rendering engine (elkjs or OP-507 solver) is ADR input

## DQ-006 — How does a Claude Code skill write to the store safely?

Unblocks: capture flow; contract artifacts (OpenAPI or MCP tool schema).

### Options
| ID | Option | Mechanism | Origin | Evidence | Label |
|---|---|---|---|---|---|
| OP-601 | Skill writes files directly into the data folder | File edits, folder added via `additionalDirectories` | research | [S-601] | Confirmed: edits prompt in default mode; no validation on write |
| OP-602 | Skill calls a local HTTP API of the running app | curl to localhost | research | [S-603] | Confirmed: fails when the app is closed. The Origin / localhost-bind / authentication rules come from the MCP Streamable HTTP spec (MUST / SHOULD / SHOULD); applying them to a plain REST API is inference |
| OP-605 | Skill calls a CLI (`arch-mind add …`) through Bash | Command-line tool with validation | challenge | — | Hypothesis |
| OP-606 | Skill writes files; a Claude Code hook validates them after each write | Validation on write | challenge | — | Hypothesis; hook behavior not verified |
| OP-603 | Plugin bundles skills + a local stdio MCP server with tools like `add_concept` | Tool calls with a schema, no network listener | research | [S-602][S-605] | Confirmed plugin bundling and stdio; Hypothesis: default permission prompt for MCP tools (not verified) |
| OP-604 | Append-only inbox; the author accepts each item inside the app | Two-step: capture now, confirm later | research | — | Hypothesis; combinable with OP-601 or OP-603 |

### Probes
| Option | Setup | Measured | Result against the criterion |
|---|---|---|---|
| OP-603 | `docs/discovery/spikes/DQ-006-mcp-capture/server.mjs` (stdio JSON-RPC, no SDK) driven by `check.mjs` | Save time; server-side rejection of a relation without source (CR-004); duplicate rejection; Markdown output | `node check.mjs` passed on 30 Oct 2026: rejected the relation without source and the duplicate; output is a `.md` with YAML frontmatter (the YAML is not parsed back). Server-side CR-004 means only "source is a non-empty string": no check that `to` exists or that `type` is from a vocabulary |
| OP-603 | `claude -p --strict-mcp-config --mcp-config …` (headless) | Does Claude Code require approval before the MCP tool runs? | Not measured: the headless run failed with «OAuth session expired». The author must check it once in an interactive session |

CR-003 is **not measured**: the probe times only the server write. A usable measure is conversation turns per capture in an interactive run.

Permissions: plugin MCP servers start automatically when the plugin is enabled; prompts exist for MCP tools and can be pre-allowed with `mcp__plugin_<plugin>_<server>__<tool>` [S-601][S-602]. Whether `add_concept` prompts by default stays an Ask for one interactive check.

Open with OP-104: where review state (scheduler data) lives, in frontmatter or a sidecar file, is untested.

### Decision
Status: Decided
Decision: OP-603 Claude Code plugin bundling the capture skill and a local stdio MCP server that validates and writes concept files; the server rejects relations without a source.
Decided by: author, 30 Oct 2026, «Accept all» (accepting the recommendation in chapter 8 of `docs/discovery/arch-mind-discovery.html`)
Route: ADR input

## Challenge
A fresh-context agent reviewed this file, both probes and the sources on 30 Oct 2026. Changes made:
- Concept-map figures: 0.82 is attributed through Schroeder 2018, not read in Nesbit & Adesope; 0.72 vs 0.43 is not a head-to-head test; nothing covers accepting AI-proposed relations (DQ-003).
- Karpicke & Blunt does not test spacing; "+ spacing" removed (OP-303).
- FSRS numbers: the baseline is constant retention, not SM-2; with same-day reviews FSRS-6 is slightly worse than the baseline (OP-404).
- ELK partitioning gives ordered column groups, not lanes; OP-502 renamed.
- Crossing count relabeled as a proxy; tab C is not comparable with A and B (straight vs orthogonal routing); CR-002 still needs the author's judgment and a definition of "at a glance".
- CR-003 marked unmeasured; CR-004 enforcement limited to "non-empty source".
- Probe relation data fixed: RFC 6265bis is an Internet-Draft; HSTS complements upgrade-insecure-requests (W3C UIR §1.1, §6.1), it is not a trade-off; mkcert issues certificates from a local CA, it does not make self-signed ones; HTTPS-requires-certificate cited to RFC 9110/2818, not RFC 8446; the category error "WebKit policy stricter than secure context" rewritten.
- server.mjs no longer crashes on a malformed line.
- New options added: OP-304, OP-405, OP-507, OP-508, OP-509, OP-605, OP-606.
- Not fixed, still Hypothesis: the DQ-002 taxonomy sources (not fetched) and WebKit vs Chromium behavior on localhost.

## Sources
- S-101 — Breadcrumbs, https://github.com/SkepticMystic/breadcrumbs, primary
- S-102 — Juggl, https://github.com/HEmile/juggl, primary
- S-103 — Obsidian Spaced Repetition, https://github.com/st3v3nmw/obsidian-spaced-repetition, primary
- S-104 — Anki releases, https://github.com/ankitects/anki/releases, primary
- S-105 — Anki MCP server (community), https://github.com/nailuoGG/anki-mcp-server, primary
- S-106 — Logseq releases, https://github.com/logseq/logseq/releases, primary
- S-107 — TheBrain API, https://blog.thebrain.com/blog/introducing-thebrain-api, vendor
- S-301 — Nesbit & Adesope 2006, Learning With Concept and Knowledge Maps, https://www.sfu.ca/~jcnesbit/research/nesbitadesope2006.htm, primary
- S-302 — Schroeder et al. 2018, Studying and Constructing Concept Maps: A Meta-Analysis, https://summit.sfu.ca/item/17789, primary
- S-303 — Karpicke & Blunt 2011, Science, https://pubmed.ncbi.nlm.nih.gov/21252317/, primary (abstract)
- S-401 — srs-benchmark, https://github.com/open-spaced-repetition/srs-benchmark, primary
- S-402 — ts-fsrs, https://github.com/open-spaced-repetition/ts-fsrs, primary
- S-501 — elkjs, https://github.com/kieler/elkjs, primary
- S-502 — dagre, https://github.com/dagrejs/dagre, primary
- S-503 — ELK partitioning option, https://eclipse.dev/elk/reference/options/org-eclipse-elk-partitioning-activate.html, primary
- S-504 — cytoscape.js-fcose, https://github.com/iVis-at-Bilkent/cytoscape.js-fcose, primary
- S-601 — Claude Code permissions, https://code.claude.com/docs/en/permissions, primary
- S-602 — Claude Code MCP (plugin-provided servers), https://code.claude.com/docs/en/mcp, primary
- S-603 — MCP transports (Streamable HTTP security), https://modelcontextprotocol.io/specification/2025-06-18/basic/transports, primary
- S-604 — OWASP CSRF Prevention Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html, primary
- S-606 — W3C Upgrade Insecure Requests, https://www.w3.org/TR/upgrade-insecure-requests/, primary
- S-607 — draft-ietf-httpbis-rfc6265bis, https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis, primary
- S-605 — Claude Code plugins reference, https://code.claude.com/docs/en/plugins-reference, primary
