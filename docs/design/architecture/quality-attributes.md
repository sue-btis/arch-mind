# Quality Attributes — arch-mind

## NFR responses
| NFR | Design response | Evidence |
|---|---|---|
| NFR-001 | Each layer is laid out by elkjs and projected isometrically onto stacked plates drawn as the UI's own SVG; Fit scale = min(1, available board width / projected width at scale 1) and zooming in is the author's choice (FR-042). Base sizes at scale 1: labels 13 px, pictograms 44 px; readable means labels at least 11 px and pictograms at least 32 px, so the floor is max(11 / 13, 32 / 44) = 0.85. The UI refuses to draw a view whose Fit scale is below 0.85 and offers narrower filters, focus on a concept or the grouped layer view, taking none of them on its own (FR-023, FR-047); focus draws only the selection's neighbourhood (FR-045) and the grouped view lays out one node per closed domain group in the partitioned elk graph (ADR-010 fallback addendum). Matrix view is a table whose columns shrink to labels rotated vertically (ADR-008). | Flat layout measured once on the TST-032 sample: 1,021 px wide (ADR-006, superseded); the projected plates at Fit size are not yet measured. Milestone acceptance: the 13-concept TST-032 view at Fit scale 0.85 or more and the matrix view at 1366 × 768 with no horizontal scrollbar, with the pinned elkjs version; a view whose Fit scale is below 0.85 is refused with the FR-023 message (ADR-008). Phase 3 acceptance: the refused over-wide fixture renders at Fit 0.85 or more both focused on one of its concepts and grouped by domain with every group closed; each group, opened alone, either keeps Fit 0.85 or more or stays closed with the FR-049 message (ADR-010 probe). |
| NFR-002 | Proposals happen in the conversation; the capture server makes one `list_concepts` call and one `save_concept` call per capture, plus one `preview_illustration` call per illustration proposal; `save_concept` can be pre-allowed with the plugin-scoped permission rule (ADR-003). | 5 real captures timed in the capture milestone, including a pictogram proposal and an illustration proposal with one preview; interactive check of the default permission prompt. |
| NFR-003 | Concept files written to a temporary file in the same folder and renamed into place; review lines appended whole with one write call (ADR-002). | Test that kills the writer mid-save and finds either the old file or the new one. |
| NFR-004 | Concepts are plain Markdown with YAML frontmatter; SEE-I under four readable headings (ADR-002, `docs/design/data/concept.schema.json`). The pictogram is one optional frontmatter id and the illustration a separate SVG file linked as a Markdown image, so the text is complete without either (ADR-009). | Open a saved concept in a plain text editor in the capture milestone; open a saved concept with an illustration in a plain Markdown viewer and in a text editor with its SVG deleted. |
| NFR-005 | Local server binds 127.0.0.1 only and checks Host and Origin; capture uses stdio with no listener (ADR-005, ADR-003). | Tests with a foreign Host and a foreign Origin; connection attempt from another device. |
| NFR-006 | Server loads all concept frontmatter and replays the review log in memory at each due-list request. | Load test with 300 generated concepts and 600 questions with one year of review lines. |

## Tradeoffs
| Decision | Improves | Worsens | Accepted because |
|---|---|---|---|
| ADR-002 box and due date computed by replay | Consistency: no stored state can drift from history (BR-006, BR-007) | Load time grows with history | About 7,300 lines a year (assumed) is far below NFR-006's budget |
| ADR-001 local server | One rules module; any browser | A listening port to defend | ADR-005 checks close the known attack paths |
| ADR-005 no token | Simplicity | Other local programs can call the API | They can already read the store files |
| ADR-006 stacked layers (superseded by ADR-008) | Width fits the reference screen | Views grow tall and need vertical scrolling | NFR-001 constrains width only |
| ADR-008 elkjs layout with the UI's own SVG plates | Plates, pictograms and labels in the author's design; selection and focus work in screen space | Zoom, hover, selection and focus are hand-written; the projected width is unmeasured | Fit size is checked at the plates milestone; React Flow tilted by CSS and a 3D engine cost more in text and accessibility |
| ADR-010 grouped view as a graph of group nodes (fallback addendum) | Reuses the partitioned elk graph, its projection and its tested invariants | Opening a group re-places the rest of the map instead of growing in place | The compound-node probe failed the scene invariants with a group open (ADR-010 fallback addendum) |
| ADR-009 pictogram field and separate SVG file | The `.md` stays readable text (NFR-004); the SVG can be validated and served as an image | Two writes per illustrated save; a possible orphan SVG after an interrupted save | An orphan is harmless, while a concept pointing to a missing file is impossible by write order |

## Threats
| Boundary crossing | Threat (STRIDE) | Mitigation or accepted risk |
|---|---|---|
| Browser page → local server | Spoofing / tampering: a hostile web page posts reviews (cross-site request) | Origin check and JSON-only bodies (ADR-005, NFR-005) |
| Browser page → local server | Information disclosure: DNS rebinding reads concepts | Host check against localhost names (ADR-005) |
| Other device → local server | Information disclosure | Bind 127.0.0.1 only (ADR-005, NFR-005) |
| Other local program → local server | Tampering | Accepted risk: such a program can already read and write the store folder (ADR-005) |
| Claude Code → capture server | Tampering: Claude saves something the author did not confirm | The skill requires confirmation in the conversation (BR-004); tool calls pass through Claude Code permissions (ADR-003); rules reject incomplete concepts |
| Hand edit → store | Tampering by mistake: a broken file | Rules module reports the file and reason instead of loading it (FR-017) |
| Claude Code → capture server → temp page → browser | Tampering / elevation of privilege: an unvalidated proposed SVG runs when previewed | `preview_illustration` validates with the same rules-module validator as save, shows the SVG only through an `<img>` element in a temporary page (no inline SVG) in the operating system's temp folder, and never writes into the store (ADR-009 addendum) |
| Claude Code → capture server → store → browser | Tampering / elevation of privilege: Claude-generated SVG carries script, event handlers, external references, foreignObject, DOCTYPE or entities and runs in the author's browser | The rules module validates every illustration against an element and attribute allowlist (no DOCTYPE or entity declarations, at most 200,000 characters) at save and at load; the UI shows illustrations only as images, never inlined; the server serves them with a restrictive Content-Security-Policy and `X-Content-Type-Options: nosniff` (ADR-009) |

## Capacity and cost
| Quantity | Estimate | Measured or assumed | Source |
|---|---|---|---|
| Concepts per year | 300 | Assumed | PRD NFR-006 |
| Concept file size | 2–4 KB | Assumed | DQ-006 probe file of one concept |
| Concept files per year | under 1.2 MB | Assumed | 300 × 4 KB |
| Reviews per day | 20 | Assumed | — |
| Review log per year | about 7,300 lines, under 1 MB | Assumed | 20 × 365, about 100 bytes per line |
| Running cost | 0 MXN per month | Assumed | Runs locally; Claude use is under the author's existing subscription |

## Operations
| Failure | How it is detected | Recovery |
|---|---|---|
| Broken concept file after a hand edit | Listed in the app with file and reason (FR-017) | Author fixes the file; next load picks it up |
| Review log line unreadable | Server reports the line number at load | Author removes or fixes that line; history before and after it stays |
| Store folder lost | Author notices on start | Restore from backup: the store folder is meant to live in a Git repository or a synced folder chosen by the author (human task: author confirms the store folder is backed up) |
| Store config missing or invalid (`~/.arch-mind/config.json`) | The local server and the capture server exit at start with a message naming the config path | Run `arch-mind setup <folder>` |
| Facet catalog missing or invalid (`facets.yaml`) | The local server exits at start, and a capture call fails, with a message naming the file | Restore the file from backup, or run `arch-mind setup <folder>` on a new folder (it never overwrites an existing `facets.yaml`) |
| Port already in use | Command prints the error | Command retries the next port and prints the address |

## Architecture rules
| Rule | Source | Check |
|---|---|---|
| Only the rules module parses or validates concept files; the UI, local server and capture server import it | ADR-001, ADR-004 | Dependency test: no other module imports the YAML parser |
| The Study UI and local server never write concept files | Domain cross-boundary rules, ADR-002 | Test: the local server has no write path to the concepts folder |
| Illustrations are shown only as images (`<img>`), never inlined into the page | ADR-009 | Test: the UI has no code path that injects SVG text into the DOM |
| Illustration files are written only by the capture server, after the rules module validated the SVG, and before the concept file that links them | ADR-009, NFR-003 | Test: the local server has no write path to `illustrations/`; a test kills the writer between the two writes and finds no concept pointing to a missing file |
| Every catalog pictogram id has artwork in the UI asset, and the four layer pictogram ids (client, network, server, data) are in the catalog | ADR-009, FR-037, FR-038 | Test: the catalog ids and the artwork file names are the same set, and the four layer ids are present |
| No React Flow in the UI; the layer plates are drawn as the UI's own SVG | ADR-008 | Dependency test: `@xyflow/react` is not in the UI's dependencies |
| Focus, grouping, the finder and the legend filter only derive what to draw from the shown concepts and the selection; none of them writes or stores anything | FR-018 (View), FR-043 to FR-048 | Test: these modules have no API write call and no persistent storage |
| Groups and their routes come from elk; no hand-written router returns for the grouped view | ADR-010, ADR-008 addendum "One elk graph" | Test: the ADR-008 scene invariants run over grouped scenes, every group closed and each group open |
| The review log is only appended | BR-007, ADR-002 | Test: the server opens the log in append mode only |
| The local server listens on 127.0.0.1 and passes every request through the guard | ADR-005 | Tests with foreign Host and Origin |
| Box and due date are never stored; they are computed by starting each recall question in box 1 on its `confirmed` day and replaying its log lines in order | BR-006, FR-030, ADR-002 | Schema has no box or due field; scheduler tests replay known histories, including a question with no reviews (due the day after `confirmed`) |
