# PRD — arch-mind


## 1. Product Overview
### Product
arch-mind is a personal study tool for software architecture. Concepts are captured from inside Claude Code sessions, stored as plain Markdown files, studied in small views that show how concepts relate across system layers, and brought back as recall questions on a schedule.

### Problem / Purpose
The author learns architecture from videos and from the design questions Claude raises during real projects. Each answer is understood in the moment and forgotten later, because it stays isolated in a chat transcript. Nothing links a new concept to known ones or to the project decision where it appeared, and nothing brings it back for review. Discovery found that what helps retention is producing the map and recalling from memory, not looking at a finished map (`docs/discovery/findings.md` DQ-003).

### Product Philosophy
- The author builds the knowledge; Claude proposes. Every saved relation, explanation and SEE-I part exists only because the author chose, wrote or approved it.
- Every relation can be traced to a source, so the map does not teach false connections.
- The knowledge outlives the app: it stays readable as plain files without arch-mind.

## 2. Target Users and Usage Context
### Primary User
The author: a single developer learning web and software architecture, who works daily with Claude Code and wants to understand and defend design decisions.

### Secondary Users
None.

### Usage Context
- Capture happens inside a Claude Code session in any of the author's project repositories, right when a concept comes up.
- Study and review happen in arch-mind on the author's own computer, in a desktop browser.
- Concept content (names, SEE-I, explanations, recall questions) is written in English.

## 3. Goals
- G-001 — A concept that comes up in a Claude Code session is captured in that session, linked to known concepts and to the episode where it appeared.
- G-002 — The author can open a focused view and follow how its concepts relate, including relations that cross layers, without scrolling sideways.
- G-003 — Weeks after capture, the author can explain a concept and its relations from memory.
- G-004 — Every relation shown can be traced to its source.
- G-005 — Each layer and concept is recognizable at a glance through a picture that alludes to the real thing, and selecting a concept shows its neighbourhood without leaving the view.

## 4. Non-Goals
- NG-001 — Multiple users, accounts, sharing or collaboration.
- NG-002 — Access from other devices or over a network, including review from a phone.
- NG-003 — A single global graph of all concepts as the main way to explore.
- NG-004 — Saving concepts, relations or explanations the author did not confirm, including automatic extraction from code or transcripts.
- NG-005 — Import, export or sync with Obsidian, Anki or other tools beyond the files being plain Markdown.
- NG-006 — Mobile apps.
- NG-007 — Adaptive scheduling (for example FSRS) in the MVP.

## 5. Core User Journeys
### J-001 — Capture a concept during project work
1. While working in a project, the author asks Claude Code to capture a concept (for example, "Secure cookie attribute").
2. arch-mind proposes candidate relations to existing concepts, each with a type, a target and a source.
3. The author keeps some relations and writes one sentence explaining each kept relation.
4. Claude drafts the concept as SEE-I (statement, elaboration, example, illustration), or the author writes it; the author accepts, edits or rewrites each part.
5. The author picks the concept's layer, domains and concerns, and names the episode (for example, "TST-032 in the web project").
6. arch-mind proposes a pictogram for the concept and, when the illustration part describes something drawable, a visual illustration; the author accepts, asks for another or declines each.
7. arch-mind proposes recall questions from what the author wrote; the author confirms them.
8. The concept is saved as a Markdown file and becomes due for review the next day.

### J-002 — Study a view
1. The author opens arch-mind and filters by domain, layer and concern (for example, web × security).
2. The layer view shows the layers as stacked plates, each with its own pictogram, and the matching concepts as pictograms on their plates with typed arrows.
3. The author selects a concept: it is marked, its relations and neighbours stay prominent and the rest recedes; its incoming and outgoing relations are listed beside the view.
4. The author follows a chain by choosing the other end of a listed relation, checks each relation's source and explanation, and reads the concept's SEE-I and illustration.
5. The author switches to the matrix view of the same filter to check every relation at once.

### J-003 — Daily review
1. The author opens the review screen and sees the questions due today.
2. For each question the author answers from memory, reveals their own explanation, and marks right or wrong.
3. A wrong answer offers the concept's detail, with each relation, its source and the author's explanation.
4. Each question is rescheduled by its Leitner box.

## 6. Product Capabilities
### CAP-001 — Capture from Claude Code
Turns a concept that came up in a session into a saved concept the author built: proposed relations the author selected and explained, a SEE-I the author wrote or reviewed, facets, episode and recall questions. Works whether or not the app is open. Rejects incomplete or inconsistent concepts with a reason.

### CAP-002 — Concept store
One readable Markdown file per concept. A concept exists once and every view refers to it. Hand edits are picked up; broken files are reported.

### CAP-003 — Views
A layer view of stacked layer plates for following chains across layers and a matrix view for checking all relations, both over the same facet filter, both fitting one laptop screen. Layers and concepts carry allusive pictograms. Selecting a concept brings its neighbourhood forward. Relations show their type, and on interaction their source and the author's explanation.

### CAP-004 — Concept detail
Shows a concept's pictogram, SEE-I with its illustration where one exists, incoming and outgoing relations with sources and explanations, episode, facets and review state, beside the view and without hiding the selected concept.

### CAP-005 — Review
Shows due recall questions, lets the author self-grade, reschedules by Leitner boxes and keeps the full review history.

## 7. Functional Requirements
### Capture
### FR-001
The author can start a capture of a named concept from a Claude Code session in any project repository.

### FR-002
The capture proposes candidate relations from the new concept to existing concepts; each proposal shows a relation type, a target concept and a source.

### FR-003
No proposed relation is saved unless the author selects it.

### FR-004
For each selected relation, the author must provide a one-sentence explanation in their own words before saving.

### FR-005
The capture offers a Claude-drafted SEE-I (statement, elaboration, example, illustration) for the concept, or lets the author write it from scratch.

### FR-033
Each of the four SEE-I parts is saved only after the author accepts, edits or rewrites it.

### FR-006
The author must assign exactly one layer, and may assign any number of domains and concerns, chosen from the configured facet lists.

### FR-007
The author may record the episode where the concept came up (project and situation).

### FR-008
The capture proposes at least one recall question derived from the author's SEE-I and explanations; only questions the author confirms are saved.

### FR-009
The capture rejects a relation without a source and states which relation is missing it.

### FR-010
The capture rejects a relation whose target concept does not exist and states which target is missing.

### FR-011
The capture rejects a new concept whose identifier already exists and states which concept it collides with.

### FR-012
The author can add relations, recall questions or an episode to an existing concept through a capture, under the same rules as a new concept.

### FR-013
Capture succeeds when the arch-mind app is not running.

### FR-014
A saved concept is a Markdown file that a plain text editor shows with readable SEE-I, relations, sources and recall questions.

### FR-034
The capture proposes one pictogram for the concept from the pictogram library; the pictogram is saved only after the author accepts it, and the author may ask for another or save the concept without one.

### FR-035
When the concept's illustration part describes a drawable scene, the capture proposes a visual illustration of it; the illustration is saved only after the author accepts it, and none is proposed when the illustration part is not drawable.

### FR-036
The author can add a pictogram or a visual illustration to an existing concept that has none, through a capture, under the same confirmation rules.

### Concept store
### FR-015
Each concept is stored exactly once; views and the review screen refer to stored concepts and never keep their own copies.

### FR-016
A change the author makes by hand to a concept file appears in the app the next time it loads the concepts.

### FR-017
A concept file that cannot be read is listed in the app with its file name and the reason; it is not silently skipped.

### Views
### FR-018
The author can filter views by any combination of domains, layers and concerns.

### FR-019
The layer view places each matching concept on the plate of its layer, with layer plates stacked in the order client, network, server, data.

### FR-020
The layer view shows each relation between matching concepts as a directed arrow labeled with its type.

### FR-021
Hovering or tapping a relation in any view shows its source and the author's explanation.

### FR-022
The matrix view shows the matching concepts as rows and columns, with the relation type in the cell where the source row meets the target column.

### FR-023
When the matching concepts would not fit the reference screen (NFR-001), the app says so instead of drawing a view that needs sideways scrolling, and offers the ways out in FR-047.

### FR-024
Selecting a concept in any view opens its detail beside the view without hiding the selected concept.

### FR-037
Each layer is shown with its own pictogram.

### FR-038
Each concept is shown with its pictogram; a concept without one is shown with its layer's pictogram.

### FR-039
Selecting a concept marks it, keeps its relations and the concepts they connect prominent, and makes every other concept and relation recede.

### FR-040
The detail of a selected concept lists its incoming and outgoing relations, each as source, type and target with its source and explanation; choosing the other end of a listed relation selects that concept.

### FR-041
The author can clear the selection, which restores every concept and relation to full prominence.

### FR-042
The author can zoom the layer view in and return it to a size that fits the screen width.

### FR-043
The author can open a finder from the keyboard, type part of a concept's title or designator, and choose a match among every concept in the store; the chosen concept becomes the selection and is brought into view, and when the filters hide it they are cleared so it can be shown. The finder does not search concept text.

### FR-044
Choosing a relation type in the wire legend keeps relations of that type prominent and makes the others recede; choosing it again restores every relation.

### FR-045
The author can focus the view on the selected concept, which then shows only that concept, its incoming and outgoing relations and the concepts they connect; leaving focus restores the filtered view.

### FR-046
A facet group whose values do not fit the filters without scrolling offers a field that narrows the values shown to those matching what the author types; values already chosen stay visible.

### FR-047
When a view would not fit (FR-023), the message offers three ways out, and the app takes none of them on its own: narrower filters, focusing on a concept (FR-045), or grouping the layer view by domain (FR-048). When the refused view is the matrix, narrower filters keep the matrix, while focusing or grouping opens the layer view focused or grouped.

### FR-048
In the grouped layer view each plate shows one group per domain with its concept count, and relations between groups are shown as one labeled connection per pair with the number of relations it stands for; opening a group shows its concepts and their relations in place.

### FR-049
Only one group is open at a time: opening a group closes the one that was open. A group whose concepts would not fit when opened (NFR-001) stays closed, and the app says so and offers focusing on one of its concepts or narrower filters.

### Concept detail
### FR-025
The concept detail shows the pictogram, the SEE-I with the visual illustration when one exists, every relation with its source and explanation, the episode, the facets and the review state of each recall question.

### Review
### FR-026
The review screen lists the recall questions due on the current day.

### FR-027
For each due question the author first answers from memory, then reveals the concept's SEE-I and relation explanations, then marks the answer right or wrong.

### FR-028
A question answered right moves up one Leitner box, stopping at the last box, and becomes due after that box's interval.

### FR-029
A question answered wrong returns to the first box and becomes due after the first box's interval.

### FR-030
A newly confirmed recall question starts in the first box and is due the day after capture.

### FR-031
After a wrong answer, the app offers to open the concept's detail (FR-025).

### FR-032
Every review is kept in history with the question, date and result.

## 8. Non-Functional Requirements
### NFR-001 — View readability
Reference screen: a desktop browser window of 1366 × 768 px at 100 % zoom. Every view the app draws fits the window width with no horizontal scrolling; for the layer view this holds at its fit size (FR-042), and zooming in is the author's choice. Acceptance: the 13-concept, 15-relation TST-032 chain from `docs/discovery/spikes/DQ-005-view-layouts/` renders as a layer view at fit size and as a matrix view, each without horizontal scrolling, with every pictogram and label readable. A set of concepts that the layer view refuses (FR-023) renders without horizontal scrolling both focused on one of its concepts (FR-045) and grouped by domain (FR-048). Discovery found no evidence for a maximum node count (DQ-003), so none is set.

### NFR-002 — Capture friction
Excluding the time the author spends writing (SEE-I, explanations, choices), one capture adds at most 60 seconds of waiting and at most 2 confirmation prompts in the Claude Code session. Measured on 5 real captures with up to 3 relations each. Not yet measured: discovery timed only the save itself (DQ-006).

### NFR-003 — Data durability
A capture either saves a complete concept file or leaves the store unchanged; an interrupted capture never leaves a partial file. Review history survives closing the app and restarting the computer.

### NFR-004 — Readable without the app
With arch-mind uninstalled, every concept's SEE-I, relations, sources and recall questions remain readable in a plain text editor. Pictograms and visual illustrations add to the text and never replace it: a concept is complete without them.

### NFR-005 — Local only
arch-mind and its capture tool accept no connections from other devices. Acceptance: from another device on the same network, no arch-mind port answers.

### NFR-006 — Review load time
With 300 concepts and 600 recall questions, the review screen shows the due questions within 2 seconds of opening on the author's computer.

## 9. Business Rules and Invariants
- BR-001 — Every saved relation has a type, an existing target concept, a source and the author's explanation.
- BR-002 — A concept exists once; its identifier is unique.
- BR-003 — Every concept has exactly one layer from: client, network, server, data.
- BR-004 — Nothing is saved without the author's confirmation of that item.
- BR-005 — Every saved concept has a complete SEE-I, each part approved by the author, and at least one confirmed recall question.
- BR-006 — Each recall question is in exactly one Leitner box and has one due date.
- BR-007 — Review history is append-only: past reviews are never rewritten.
- BR-008 — A concept has at most one pictogram and at most one visual illustration; the pictogram comes from the pictogram library.
- BR-009 — In the grouped layer view a concept belongs to exactly one group: its first listed domain, or a "No domain" group when it has none.

## 10. Product / UX Principles
- UX-001 — Views look like arch-mind's own design, with layers as stacked plates; generic diagram styling is not acceptable for the layer view.
- UX-004 — Pictograms and illustrations allude to the real thing a layer or concept is, and never carry meaning alone: each is shown with the name or text it stands for.
- UX-002 — The review screen never shows the answer before the author has tried to recall it.
- UX-003 — Any rejection names the exact field or relation and what is missing.

## 11. Hard Constraints
- CON-001 — arch-mind is a web app with its own capture skills for Claude Code.
- CON-002 — Concepts are stored as Markdown files.
- CON-003 — Review with recall questions is part of the MVP.
- CON-004 — Repository artifacts (code, docs, file names) and concept content are in English.
- CON-005 — Runs only on the author's own computer.

## 12. MVP Scope
### In
- FR-001 to FR-014, FR-033 — Capture from Claude Code with author-built relations, SEE-I, facets, episode and recall questions.
- FR-015 to FR-017 — Markdown concept store.
- FR-018 to FR-024 — Layer view and matrix view over facet filters.
- FR-025 — Concept detail.
- FR-026 to FR-032 — Leitner review with history.

### Phase 2 — Illustrated, responsive study
- FR-034 to FR-036 — Pictogram and visual illustration proposed at capture and confirmed by the author.
- FR-019, FR-024, FR-025 as amended, FR-037 to FR-042 — Layer plates with pictograms, a selection that brings the neighbourhood forward, navigable relations and zoom to fit.
- BR-008, UX-001 as amended, UX-004.

### Phase 3 — Navigation at scale
- FR-043, FR-044 — Finder by title or designator, and the wire legend as a relation-type filter.
- FR-023 as amended, FR-045 to FR-049 — Focus on a concept, searchable facet filters, and a layer view grouped by domain, offered when a view would not fit.
- BR-009.

### Out
- Phone or network access.
- Static exports, other layouts.
- FSRS or other adaptive scheduling.
- Editing concepts inside the app (hand edits to files and capture cover changes).
- Search across concept text (finding a concept by title or designator is in scope, FR-043).

## 13. Success Criteria
- SC-001 — After 8 weeks of use, the author has captured at least 30 concepts from real project sessions.
- SC-002 — For concepts captured at least 4 weeks earlier, the author answers at least 70 % of their recall questions right in review.
- SC-003 — The author can explain the TST-032 chain (why WebKit dropped the cookie and why Lighthouse broke) from memory 4 weeks after capturing it.
- SC-004 — NFR-001 and NFR-002 pass their acceptance checks.

## 14. Future Product Scope
- Review from a phone.
- Adaptive scheduling (FSRS) using the kept review history.
- A matrix view grouped by layer or domain, with collapsible groups.
- Editing concepts inside the app.

## 15. Product Decisions
| ID | Question | Status | Decision | Decided by | Date | Quote | Affects |
|---|---|---|---|---|---|---|---|
| PD-001 | What kind of product is it? | Decided | A web app with its own capture skills, so the visual design can be unique | author | 2026-10-29 | «A web app with its own skills, rather; that would be ideal to achieve a unique design; Mermaid doesn't reach it at all» (translated) | §1, CON-001, UX-001 |
| PD-002 | Is review in the MVP? | Decided | Simple review with recall questions | author | 2026-10-29 | «Yes, simple (Recommended)» (translated) | CAP-005, CON-003 |
| PD-003 | How is the taxonomy chosen? | Decided | After discovery compares existing taxonomies | author | 2026-10-29 | «Research it (Recommended)» (translated) | PD-007 |
| PD-004 | Product name | Decided | arch-mind | author | 2026-10-29 | «arch-mind» | §1 |
| PD-005 | Build or adopt? | Decided | Build; Obsidian reviewed and rejected; hybrid with Markdown files as the store | author | 2026-10-30 | «I reviewed Obsidian, but it does not reach what I actually want» and «Accept all» (translated / verbatim) | CAP-002, CON-002, NFR-004 |
| PD-006 | Who builds relations and explanations? | Decided | Claude proposes relations with sources; the author selects and explains each. SEE-I authorship is refined by PD-018 | author | 2026-10-30 | «Accept all» | FR-002 to FR-004, FR-008, BR-004 |
| PD-007 | How are concepts sliced into views? | Decided | Facets: one layer, domains, concerns | author | 2026-10-30 | «Accept all» | FR-006, FR-018, BR-003 |
| PD-008 | How are reviews scheduled? | Decided | Leitner boxes first; review history kept so FSRS can replace it later | author | 2026-10-30 | «Accept all» | FR-028 to FR-032, NG-007 |
| PD-009 | Which views? | Decided | A layer view that fits one screen, plus a matrix view | author | 2026-10-30 | «A and D seem useful» and «Accept all» | FR-019 to FR-023 |
| PD-010 | Can a relation without a source be saved? | Decided | No, it is rejected at capture | author | 2026-10-30 | «Accept all» | FR-009, BR-001 |
| PD-011 | What does "reads at a glance" mean? | Decided | The view fits a 1366 × 768 laptop screen with no sideways scrolling; sources show on hover or tap; no node limit; the app suggests narrower filters when a view does not fit | author | 2026-10-30 | «Fits on screen (Recommended)» (translated) | NFR-001, FR-021, FR-023 |
| PD-012 | Where does arch-mind run? | Decided | Only on the author's computer | author | 2026-10-30 | «Only your computer (Recommended)» (translated) | NFR-005, CON-005, NG-002 |
| PD-013 | Language of concept content | Decided | English | author | 2026-10-30 | «English» (translated) | CON-004, §2 |
| PD-014 | What was the sixth must criterion? | Decided | There is none; the four musts and one nice-to-have stand | author | 2026-10-30 | «There is no sixth» (translated) | `docs/discovery/findings.md` CR-006 |
| PD-015 | How is frictionless capture measured once the author writes SEE-I and explanations? | Decided | The one-minute limit covers only what the tool adds, not the author's writing | author | 2026-10-30 | «Without counting your writing (Recommended)» (translated) | NFR-002 |
| PD-018 | Must the author write the SEE-I alone? | Decided | No. SEE-I is used but not forced on the author: Claude can draft it and the author reviews each part, the same review layer as relations and layers | author | 2026-10-30 | «I see the author writing the concept as SEE-I as useful but not forced; it can be together with the AI, or a review layer like the relations and layers» (translated) | FR-005, FR-033, BR-005, J-001 |
| PD-019 | Are the proposed numeric targets accepted? | Decided | NFR-006 (review screen within 2 s at 300 concepts / 600 questions) and SC-001 to SC-003 as written | author | 2026-10-30 | «Accept them» | NFR-006, SC-001, SC-002, SC-003 |
| PD-020 | What happens after a wrong answer in review? | Decided | The app offers the concept's detail, which lists every relation with its source and explanation; no concept-and-neighbors view in the MVP | author | 2026-10-30 | «Open the detail (Recommended)» (translated) | FR-031, J-003, `docs/design/ux/review-flow.mmd` |
| PD-021 | What does the second phase of the study screen become? | Decided | Combine stacked layer plates with a relation drawer, and add illustrative visual representations | author | 2026-11-01 | «creo que el 2 y 3 pueden ir de la mano, sumado a que faltaria la parte como iconos, representaciones visuales ilustrativas» (verbatim, Spanish) | J-002, CAP-003, CAP-004, FR-019, FR-024, FR-037 to FR-042, G-005 |
| PD-022 | Where do illustrative pictures appear? | Decided | Pictograms for layers and concepts, plus a SEE-I visual illustration only where it applies | author | 2026-11-01 | «capa + cocnepto e ilustracion see - i unicamente dodne aplica yo se que no en todo aplica» (verbatim, Spanish) | FR-034 to FR-038, FR-025, BR-008 |
| PD-023 | Which visual style for pictograms? | Decided | Isometric mini-objects | author | 2026-11-01 | «Isometric mini-objects (Recommended)» | UX-004, `DESIGN.md` |
| PD-024 | Who chooses a concept's pictogram? | Decided | Claude proposes it at capture from a fixed library and the author confirms | author | 2026-11-01 | «Claude proposes at capture (Recommended)» | FR-034, FR-036, BR-004, BR-008 |
| PD-025 | Who creates the SEE-I visual illustration? | Decided | Claude proposes it at capture only when the illustration part is drawable; the author accepts, asks again or declines | author | 2026-11-01 | «Claude proposes, you confirm (Recommended)» | FR-035, FR-036, BR-004 |
| PD-026 | What happens when no library pictogram fits a concept? | Decided | The concept is shown with its layer's pictogram; a capture is never blocked for it | author | 2026-11-01 | «Use the layer pictogram (Recommended)» | FR-034, FR-038 |
| PD-027 | Do the layer plates replace the flat layer view? | Decided | Yes: plates, matrix and review; the flat layer view is retired | author | 2026-11-01 | «Plates replace it (Recommended)» | FR-019, UX-001, `docs/design/architecture/adr/ADR-006-layer-view-layout.md` |
| PD-016 | Leitner box count and intervals | Open | Discovery used 5 boxes of 1, 3, 7, 16 and 35 days as an example, not a researched value. Authority: author | — | — | — | FR-028, FR-029 |
| PD-017 | Who maintains the facet lists (layers are fixed; domains and concerns)? | Open | Whether the author can add domains and concerns during capture or only in a settings file. Authority: author | — | — | — | FR-006 |
| PD-028 | What does the finder search? | Decided | Concept titles and designators only; concept text stays out of scope | author | 2026-11-01 | «Título y designador (Recommended)» (verbatim, Spanish) | FR-043, §12 Out |
| PD-029 | Which ways of handling views that do not fit join the requirements now (offered: A focus on a concept, B layer view grouped by domain, called semantic zoom, C grouped matrix, D searchable facet filters)? | Decided | A, B and D; C, the grouped matrix, stays future scope | author | 2026-11-01 | «A modo foco (Recommended),D filtros con búsqueda (Recommended),B zoom semántico» (verbatim, Spanish) | FR-045, FR-046, FR-048, §14 |
| PD-030 | How far does focus reach? | Decided | One step: the concept, its relations and the concepts they connect | author | 2026-11-01 | «1 salto (Recommended)» (verbatim, Spanish) | FR-045 |
| PD-031 | What does the app do when a view would not fit? | Decided | It says so and offers the ways out; it never switches on its own | author | 2026-11-01 | «Pide filtrar y ofrece foco (Recommended)» (verbatim, Spanish) | FR-023, FR-047 |
| PD-032 | When is the layer view grouped by domain? | Decided | Only when the author chooses it from the would-not-fit message | author | 2026-11-01 | «Solo si no cabe (Recommended)» (verbatim, Spanish) | FR-047, FR-048 |
| PD-033 | Which group holds a concept with several domains? | Decided | Its first listed domain, so each concept appears once | author | 2026-11-01 | «Su primer domain (Recommended)» (verbatim, Spanish) | BR-009 |
| PD-035 | What happens when opening a group would make the grouped view not fit? | Decided | One group open at a time; a group that would not fit alone stays closed and the app offers focus or narrower filters | author | 2026-11-01 | «Uno abierto a la vez (Recommended)» (verbatim, Spanish) | FR-049, review RV-003 F-021 |
| PD-036 | Which ways out does a refused matrix view offer? | Decided | Narrower filters keep the matrix; focus and grouping open the layer view focused or grouped | author | 2026-11-01 | «Llevan a capas (Recommended)» (verbatim, Spanish) | FR-047, review RV-003 F-022 |
| PD-037 | Which concepts does the finder search? | Decided | Every concept in the store; choosing one hidden by the filters clears them | author | 2026-11-01 | «Todo el store (Recommended)» (verbatim, Spanish) | FR-043, review RV-003 F-025 |
| PD-034 | When do the finder, legend filter and scaling options enter the product? | Decided | In one PRD amendment after M06 | author | 2026-11-01 | «Después de M06 (Recommended)» (verbatim, Spanish) and «Yes, add them» | FR-043 to FR-049, §12 |

## 16. Product Traceability
| Capability / Journey | Requirements |
|---|---|
| CAP-001 / J-001 | FR-001 to FR-014, FR-033, FR-034 to FR-036, NFR-002, NFR-003, BR-001, BR-002, BR-004, BR-005, BR-008 |
| CAP-002 | FR-015 to FR-017, NFR-003, NFR-004, BR-002 |
| CAP-003 / J-002 | FR-018 to FR-024, FR-037 to FR-049, NFR-001, UX-001, UX-004, BR-009 |
| CAP-004 / J-002, J-003 | FR-025, FR-031, FR-040 |
| CAP-005 / J-003 | FR-026 to FR-032, NFR-006, BR-006, BR-007, UX-002 |
