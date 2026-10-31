---
name: capture-concept
description: Save an architecture concept the author has just understood into the arch-mind store. Use when the author asks to capture, save or remember a concept.
---

Save only what the author has confirmed in this conversation. Never invent a source.

1. Call `list_concepts` once to see the existing concept ids and the allowed domains and concerns.
2. Agree with the author on the complete concept before saving:
   - `id` (lowercase kebab-case), `title`, one `layer` (client, network, server or data);
   - `domains` and `concerns` taken only from the allowed lists;
   - the four SEE-I parts: `statement`, `elaboration`, `example`, `illustration`;
   - each `relations` entry: `type`, `to` (an existing concept id), a `source` the author can point to, and a short `explanation`;
   - at least one `recall` question, as `{ "question": "..." }`.
3. Call `save_concept` with the confirmed concept.
4. If the result is a rejection, show the author each error's `path` and `rule`, fix it together, and call again. Nothing was written by a rejected call.
5. On success, tell the author the file path returned by the tool.
