---
name: capture-concept
description: Save an architecture concept the author has just understood into the arch-mind store, or add to one already stored. Use when the author asks to capture, save, remember or extend a concept.
---

Claude proposes; the author decides. Save only what the author selected, explained, accepted or rewrote in this conversation. Never invent a source, and never save an id, title, layer, domain, concern, relation, SEE-I part or question the author did not confirm.

New concept:

1. Call `list_concepts` once to see the existing concept ids and the allowed domains and concerns. Use only those domains and concerns.
2. In one message, propose:
   - `id` (lowercase kebab-case), `title`, one `layer` (client, network, server or data), and `domains` and `concerns` from the allowed lists;
   - candidate `relations`, each with a `type`, a `to` (an existing concept id) and a `source` the author can point to;
   - a draft of the four SEE-I parts: `statement`, `elaboration`, `example`, `illustration`;
   - recall questions, each as `{ "question": "..." }`.
3. Ask the author, in one reply, to:
   - confirm or change the `id`, `title`, `layer`, `domains` and `concerns`;
   - keep or drop each relation, and write the one-sentence `explanation` of each kept relation in their own words;
   - accept, edit or rewrite each SEE-I part;
   - confirm, edit or drop each question (at least one is required);
   - optionally name an episode: `{ "project": "...", "situation": "...", "date": "YYYY-MM-DD" }` (date optional).
4. Call `save_concept` with only what the author confirmed.

Add to a stored concept (relations, recall questions or an episode):

1. Call `get_concept` with the id, so you do not repeat what is stored.
2. Propose and confirm the additions as above; the author writes the `explanation` of each relation.
3. Call `extend_concept` with `id` and only the additions. It never changes or removes stored fields; titles, facets and SEE-I are changed by editing the file by hand.

After either save call:

- If the result is a rejection, show the author each error's `path` and `rule`, fix it together, and call again. Nothing was written by a rejected call.
- On success, tell the author the file path returned by the tool and that the first review is due tomorrow.
