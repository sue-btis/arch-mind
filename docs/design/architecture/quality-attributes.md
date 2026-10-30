# Quality Attributes — arch-mind

## NFR responses
| NFR | Design response | Evidence |
|---|---|---|
| NFR-001 | Layer view laid out by elkjs top to bottom with one partition per layer, drawn by React Flow fitted to the window width; the UI refuses to draw a view wider than the reference screen and suggests narrower filters (FR-023). Matrix view is a table whose columns shrink to labels rotated vertically (ADR-006). | Measured once on the TST-032 sample: 1,021 px wide (ADR-006). Milestone acceptance with the pinned elkjs version. |
| NFR-002 | Proposals happen in the conversation; the capture server makes one `list_concepts` call and one `save_concept` call per capture; `save_concept` can be pre-allowed with the plugin-scoped permission rule (ADR-003). | 5 real captures timed in the capture milestone; interactive check of the default permission prompt. |
| NFR-003 | Concept files written to a temporary file in the same folder and renamed into place; review lines appended whole with one write call (ADR-002). | Test that kills the writer mid-save and finds either the old file or the new one. |
| NFR-004 | Concepts are plain Markdown with YAML frontmatter; SEE-I under four readable headings (ADR-002, `docs/design/data/concept.schema.json`). | Open a saved concept in a plain text editor in the capture milestone. |
| NFR-005 | Local server binds 127.0.0.1 only and checks Host and Origin; capture uses stdio with no listener (ADR-005, ADR-003). | Tests with a foreign Host and a foreign Origin; connection attempt from another device. |
| NFR-006 | Server loads all concept frontmatter and replays the review log in memory at each due-list request. | Load test with 300 generated concepts and 600 questions with one year of review lines. |

## Tradeoffs
| Decision | Improves | Worsens | Accepted because |
|---|---|---|---|
| ADR-002 box and due date computed by replay | Consistency: no stored state can drift from history (BR-006, BR-007) | Load time grows with history | About 7,300 lines a year (assumed) is far below NFR-006's budget |
| ADR-001 local server | One rules module; any browser | A listening port to defend | ADR-005 checks close the known attack paths |
| ADR-005 no token | Simplicity | Other local programs can call the API | They can already read the store files |
| ADR-006 stacked layers | Width fits the reference screen | Views grow tall and need vertical scrolling | NFR-001 constrains width only |

## Threats
| Boundary crossing | Threat (STRIDE) | Mitigation or accepted risk |
|---|---|---|
| Browser page → local server | Spoofing / tampering: a hostile web page posts reviews (cross-site request) | Origin check and JSON-only bodies (ADR-005, NFR-005) |
| Browser page → local server | Information disclosure: DNS rebinding reads concepts | Host check against localhost names (ADR-005) |
| Other device → local server | Information disclosure | Bind 127.0.0.1 only (ADR-005, NFR-005) |
| Other local program → local server | Tampering | Accepted risk: such a program can already read and write the store folder (ADR-005) |
| Claude Code → capture server | Tampering: Claude saves something the author did not confirm | The skill requires confirmation in the conversation (BR-004); tool calls pass through Claude Code permissions (ADR-003); rules reject incomplete concepts |
| Hand edit → store | Tampering by mistake: a broken file | Rules module reports the file and reason instead of loading it (FR-017) |

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
| Port already in use | Command prints the error | Command retries the next port and prints the address |

## Architecture rules
| Rule | Source | Check |
|---|---|---|
| Only the rules module parses or validates concept files; the UI, local server and capture server import it | ADR-001, ADR-004 | Dependency test: no other module imports the YAML parser |
| The Study UI and local server never write concept files | Domain cross-boundary rules, ADR-002 | Test: the local server has no write path to the concepts folder |
| The review log is only appended | BR-007, ADR-002 | Test: the server opens the log in append mode only |
| The local server listens on 127.0.0.1 and passes every request through the guard | ADR-005 | Tests with foreign Host and Origin |
| Box and due date are never stored; they are computed by starting each recall question in box 1 on its `confirmed` day and replaying its log lines in order | BR-006, FR-030, ADR-002 | Schema has no box or due field; scheduler tests replay known histories, including a question with no reviews (due the day after `confirmed`) |
