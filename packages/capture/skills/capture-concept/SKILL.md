---
name: capture-concept
description: Save an architecture concept the author has just understood into the arch-mind store, or add to one already stored. Use when the author asks to capture, save, remember or extend a concept.
---

Claude proposes; the author decides. Save only what the author selected, explained, accepted or rewrote in this conversation. Never invent a source, and never save an id, title, layer, domain, concern, relation, SEE-I part, pictogram, illustration or question the author did not confirm.

New concept:

1. Call `list_concepts` once to see the existing concept ids, the allowed domains and concerns, and the pictogram catalog (`pictograms`, each with an `id` and a one-line `meaning`). Use only those domains and concerns.
2. In one message, propose:
   - `id` (lowercase kebab-case), `title`, one `layer` (client, network, server or data), and `domains` and `concerns` from the allowed lists;
   - candidate `relations`, each with a `type`, a `to` (an existing concept id) and a `source` the author can point to;
   - a draft of the four SEE-I parts: `statement`, `elaboration`, `example`, `illustration`;
   - one `pictogram` from the catalog, named by its `id` with its meaning so the author can judge the fit; propose none when no entry fits;
   - recall questions, each as `{ "question": "..." }`.
3. Ask the author, in one reply, to:
   - confirm or change the `id`, `title`, `layer`, `domains` and `concerns`;
   - keep or drop each relation, and write the one-sentence `explanation` of each kept relation in their own words;
   - accept, edit or rewrite each SEE-I part;
   - accept, change or decline the pictogram;
   - confirm, edit or drop each question (at least one is required);
   - optionally name an episode: `{ "project": "...", "situation": "...", "date": "YYYY-MM-DD" }` (date optional).
4. Propose an illustration only when the `illustration` part describes a scene that can be drawn; for an abstract part, propose none and do not ask. If it is drawable:
   - draw one SVG that stays inside the allowlist: a single root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="...">`, shapes (`path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`), `g`, `defs`, `text`, `tspan`, gradients and their `stop`s, `clipPath`, `mask`, `use` with a local `#fragment`, `title` and `desc`, plus plain presentation attributes. Style only through attributes (`fill`, `stroke`, `opacity`, `style="fill:#fff"`...), whose values are colors, numbers, lengths, keywords or `url(#id)`; never a `<style>` element, a backslash, a CSS comment or `filter`. Declare `xmlns:xlink` before using `xlink:href`. No `script`, `foreignObject`, `image`, event attributes (`on...`), external or `data:` URLs, DOCTYPE, CDATA or more than 200,000 characters;
   - call `preview_illustration` with the concept `id` and the SVG. It opens a browser page for the author and writes nothing into the store; it does not need the app running. If it answers `invalid_illustration`, fix the SVG and preview again;
   - ask the author to accept it, ask for another drawing (preview the new one) or decline it.
5. Call `save_concept` with only what the author confirmed, adding `pictogram` and `illustration` (the SVG text, never a file name or a link) only when the author accepted them. A declined proposal is simply left out.

Add to a stored concept (relations, recall questions or an episode):

1. Call `get_concept` with the id, so you do not repeat what is stored.
2. Propose and confirm the additions as above; the author writes the `explanation` of each relation. If `get_concept` shows no `pictogram`, you may propose one; if its `seeI.illustration` has no image link and is drawable, you may propose an illustration, with the same preview and the same accept, ask again or decline choice.
3. Call `extend_concept` with `id` and only the additions, including an accepted `pictogram` or `illustration`. It never changes or removes stored fields; titles, facets and SEE-I are changed by editing the file by hand. A concept that already has a pictogram or an illustration (a broken image link counts) answers `already_present`: tell the author, and do not try to replace it.

After either save call:

- If the result is a rejection, show the author each error's `path` and `rule`, fix it together, and call again. Nothing was written by a rejected call.
- On success, tell the author the file path returned by the tool (and `illustrationFile` when one was saved) and that the first review is due tomorrow.

Permissions: `preview_illustration` opens a browser page, so each call asks for approval unless the author pre-allows it the same way as `save_concept`, with a Claude Code permission rule for the tool (`mcp__plugin_arch-mind_capture__preview_illustration`, beside the one for `save_concept`). Mention this once if the author finds the preview prompts slow.
