---
name: arch-mind
description: A personal architecture study tool whose diagrams read like a wiring harness laid out on stacked layer plates, inside a calm, Apple-like neutral interface.
colors:
  gray-0: "#ffffff"
  gray-1: "#f5f5f7"
  gray-2: "#e8e8ed"
  gray-3: "#d2d2d7"
  gray-4: "#aeaeb2"
  gray-5: "#86868b"
  gray-6: "#6e6e73"
  gray-7: "#48484a"
  gray-8: "#2c2c2e"
  gray-9: "#1c1c1e"
  gray-10: "#000000"
  correction-red: "#c4262e"
  correction-red-dark: "#ff6961"
  wire-requires: "#b4237a"
  wire-requires-dark: "#f472b6"
  wire-complements: "#15803d"
  wire-complements-dark: "#4ade80"
  wire-contains: "#8a6d00"
  wire-contains-dark: "#facc15"
  layer-client: "#1d5fd1"
  layer-client-dark: "#7fb0ff"
  layer-network: "#0b7a6a"
  layer-network-dark: "#4fd1bd"
  layer-server: "#a8500a"
  layer-server-dark: "#f0a45c"
  layer-data: "#7a3fbf"
  layer-data-dark: "#c39bff"
typography:
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.1em"
  designator:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    fontFeature: "tnum"
  plate-label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.08em"
  board-label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "16px"
  wire-label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  board: "0px"
  control: "8px"
  floating: "12px"
  panel: "16px"
  sheet: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gray-9}"
    textColor: "{colors.gray-0}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.gray-9}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.gray-1}"
  view-switch:
    backgroundColor: "{colors.gray-0}"
    rounded: "{rounded.floating}"
    padding: "4px"
  view-switch-segment-active:
    backgroundColor: "{colors.gray-9}"
    textColor: "{colors.gray-0}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
  zoom-button:
    backgroundColor: "transparent"
    textColor: "{colors.gray-9}"
    rounded: "{rounded.control}"
    height: "28px"
    width: "28px"
  filters-island:
    backgroundColor: "#ffffffd1"
    rounded: "{rounded.panel}"
    padding: "12px"
    width: "200px"
  concept-sheet:
    backgroundColor: "#ffffffd1"
    rounded: "{rounded.sheet}"
    padding: "16px"
    width: "420px"
  relation-popover:
    backgroundColor: "{colors.gray-0}"
    rounded: "{rounded.floating}"
    padding: "12px"
    width: "320px"
  fit-message:
    backgroundColor: "{colors.gray-0}"
    typography: "{typography.body}"
    rounded: "{rounded.floating}"
    padding: "16px"
  concept-object:
    typography: "{typography.board-label}"
    rounded: "{rounded.board}"
    size: "44px"
  matrix-cell:
    rounded: "{rounded.board}"
    size: "32px"
---

# Design System: arch-mind

## Overview

**Creative North Star: "The Wiring Harness"**

**The Harness Thesis.** Every diagram is a wiring harness: concepts are connectors, drawn as small isometric objects standing on the board, relations are wires whose color code names the relation type, and the four layers (client, network, server, data) are tinted plates stacked top to bottom. Around the board sits a quiet, Apple-like neutral interface that never competes with it.

Two languages share each screen on purpose. The interface is soft: rounded panels and controls, generous spacing, neutrals from one gray ramp. The board is exact: flat plates in one fixed projection, pictograms drawn on one isometric grid with 1px outlines, wires laid out by elk with a label on every one. The contrast is the identity, not an accident.

Motion explains what changed, and it moves like something with weight. Every camera move glides on a damped spring that overshoots by under 1% and settles inside 600ms: the zoom buttons and Fit, the framing of a selection, the return when it is cleared. A released drag keeps sliding with decaying inertia. Keyboard focus moves the view at once, so it never lags behind the keys. Selecting a concept lifts it, draws its wires on and lets everything else recede; the view switch thumb, the review card flip, the card's entrance and the islands stepping away in Review use the same spring; the answered card leaves on a plain ease-out so it never overshoots on its way out. When a filter changes, the concepts glide to their new places while the wires, whose routes were recomputed, step aside and come back once the concepts have settled. Sheets, popovers and revealed answers enter briefly. Under reduced motion every camera move is instant, inertia, lift, draw-on, flip and thumb slide are dropped, and every entrance becomes a plain fade.

The interface runs in light and dark mode with equal care; neither is the default. The mode follows the operating system (`prefers-color-scheme`); there is no in-app toggle.

**Key Characteristics:**
- One 11-step gray ramp, remapped by role for dark mode; no other grays.
- Near-black ink as the only action color in light mode, near-white in dark mode.
- Meaningful color only inside the board: layer keys on plates, pictogram faces and designators, three wire hues.
- Inter only; tabular figures only where numbers are compared.
- Rounded interface, sharp-cornered board; the material shadow for the translucent islands, drawer and review card and the floating shadow for opaque popovers, translucent islands and drawer over a blurred backdrop (opaque under `prefers-reduced-transparency` or without `backdrop-filter`), flat plates.
- The plates shrink to fit down to a floor of 0.85 and are refused below it; zoom runs continuously from Fit to 3 times Fit with Ctrl or Cmd and the wheel or a trackpad pinch, the buttons step through 1, 1.5, 2 and 3 times, zoom never goes below Fit, and the view pans at every zoom.
- The finder: Ctrl K (Cmd K on macOS) opens a modal dialog named "Find a concept" in the Layers and Matrix views; in Review the shortcut does nothing. A text field and a list of matches follow the combobox and listbox pattern. Matching reads titles and designators only, over every concept in the store, case-insensitively and ranked designator, then title prefix, then title substring; designators use the whole-store numbering, so a concept the filters hide has one name. Arrow keys move the active match, Enter chooses it, Escape closes the finder alone (not the drawer or a pinned popover) and returns focus to where it was. Choosing a concept selects it and opens its drawer, and resets only the facets that hide it to All; if that makes the view too wide, the fit message shows and the drawer still opens. The matrix scrolls the chosen row into view. The dialog enters on the spring over a light scrim.
- The legend toggles: each entry is a pressed-state button named by its type. The active type keeps its wires, chips and matrix cells prominent and the others recede like far concepts; with a selection a wire or cell stays prominent only if it is both in the neighbourhood and of that type. Pressing the type again, or Escape with no dialog or drawer open, restores every relation.
- Deferred by the author's decision, not built: concept illustrations (M07), chain tracing, the trace pulse, the pin table and splice dots.

## Colors

A neutral interface from one gray ramp, with hue reserved for the board and for correction.

### Primary
- **Ink Action** (`{colors.gray-9}` in light, `{colors.gray-1}` in dark): the single action color. It fills the primary button and the active view segment, draws the 2px focus ring (offset 2px) and the focus ellipse on the board, and tints checkboxes. It is the same value as body text; pressability is carried by the filled shape, not by a hue.

### Secondary
- **Correction Red** (`{colors.correction-red}` / `{colors.correction-red-dark}`): only for load errors, failed requests and a review answer marked wrong. Never decorative, never a hover state.

### Tertiary
- **Layer Keys** (`{colors.layer-client}`, `{colors.layer-network}`, `{colors.layer-server}`, `{colors.layer-data}` and their `-dark` mirrors): client blue, network teal, server amber-brown, data violet. They color the plate (face at 7% opacity, edge at 55% opacity), the plate name, the three shaded faces of every pictogram on that plate, the concept designator, and the designators in the matrix headers.
- **Wire Code** (`{colors.wire-requires}`, `{colors.wire-complements}`, `{colors.wire-contains}` and their `-dark` mirrors): magenta for `requires`, green for `complements`, olive-gold for `contains`. Only these three exact core verbs (matched after trimming, lowercasing and collapsing spaces) get a hue. Each carries a short code: `rq`, `cp`, `ct`.
- **Graphite Wire** (`{colors.gray-7}` in light, `{colors.gray-4}` in dark): every other free-text relation type. `alternative to` is drawn in graphite dashed (5 on, 4 off) with the code `alt`, because an alternative is not a dependency and does not earn a fourth hue.

### Neutral
- **Canvas** (`{colors.gray-1}` light / `{colors.gray-10}` dark): the full-window canvas behind the islands and the plates, with a faint dot grid; also the wire-chip fill and the halo behind concept labels.
- **Panel** (`{colors.gray-0}` light / `{colors.gray-9}` dark): the islands, sheet, popover, review card and the matrix.
- **Hairline** (`{colors.gray-3}` light / `{colors.gray-7}` dark): every 1px interface border and matrix grid line.
- **Ink** (`{colors.gray-9}` light / `{colors.gray-1}` dark): body text, concept labels and wire labels.
- **Muted Ink** (`{colors.gray-6}` light / `{colors.gray-4}` dark): secondary text, section labels, counts (including a plate's "shown" count), "no concepts shown", inactive view segments, the zoom value.
- **Pictogram Outline** (`{colors.gray-9}` light / `{colors.gray-10}` dark): the 1px outline and dark details of every pictogram.
- **Scrollbar** (`{colors.gray-4}`): the only use of step 4 in light mode.

### Named Rules
**The Quarantine Rule.** Meaningful color lives only inside the board. Everything outside it is neutral, plus the ink action color for what can be pressed and correction red for what went wrong. The one deliberate exception, chosen by the author, is the wire legend island: its swatches repeat the wire code so the code can be read without hovering a wire. The second exception, also the author's, is the layer color in the drawer header: the pictogram, a layer-tinted pill that spells the layer and a 10% header wash identify which layer the concept lives on, the same way a plate does. No other color leaves the board.

**The Double Carrier Rule.** No meaning rides on color alone. Every wire keeps its free-text label, every coded matrix swatch shows its letter code, every plate shows its name, every designator spells its layer initial, and every pictogram's meaning is written out in its tooltip and in the concept list.

Measured contrast for the plates, both modes: all text at or above 4.5:1; the tightest pair is muted ink on the light plate tint at 4.59:1. Matrix swatch codes measured earlier at or above 4.92:1 (the matrix is unchanged). Wire strokes and the focus ellipse on plate tints have not been re-measured since the plates replaced the zones.

## Typography

**Display Font:** none
**Body Font:** Inter Variable (with ui-sans-serif, system-ui, sans-serif)

**Character:** One neutral grotesque for interface and board alike; hierarchy is size and weight on a small, tight scale.

### Hierarchy
- **Title** (600, 17px, tracking -0.025em): sheet and review headings.
- **Headline** (600 or 500, 15px): the product name in the header (600, tight tracking) and the current review question (500).
- **Body** (400, 13px, line-height 1.5): all interface text, popover, sheet, fit message and concept list. Emphasis inside body uses 500 or 600, never a size change.
- **Label** (600, 11px, tracking 0.1em, uppercase): section headings in the filters island, sheet and review.
- **Designator** (600, 11px, tabular figures): matrix designators such as C1, N3, colored by layer key.
- **Plate Label** (600, 13px, tracking 0.08em, uppercase, layer key): the plate name centered beneath its layer pictogram, followed by the shown count in muted 400 tabular figures with no tracking.
- **Board Label** (400, 13px, 16px lines): the concept label under each pictogram, up to two lines (about 18 characters each, the first line shortened by the designator) with an ellipsis past that. The designator leads the first line in 600 tabular figures in the layer key. A 4px halo in the canvas color, painted under the text, keeps labels legible where they cross a wire or a plate edge.
- **Wire Label** (400, 13px, 16px lines): relation type on every wire, up to two lines of about 16 characters (no narrower wrap), on a sharp-cornered canvas-colored chip padded 4px by 2px, set inline on its wire.

### Named Rules
**The One Face Rule.** Inter carries the whole product, interface and board alike. Hierarchy comes from size and weight, never from a second family.

**The Tabular Figures Rule.** Tabular figures apply only where numbers are compared: designators, counts (concepts, relations, shown, layer counts, zoom, due, question position, box) and dates. Prose stays proportional.

**The 13 Pixel Board Rule.** Board text is set at 13px at a Fit scale of 1 so it stays at or above 11px on screen at the 0.85 floor. Text on the board is never sheared or squashed by the plate projection; only its anchor point is projected.

## Layout

The study screen is one full-window canvas in the canvas gray with a faint dot grid; the page never scrolls. The plates, the matrix and the review card live on it, and the controls float over it as islands 16px from the window edge, each a translucent panel (the panel color at 82% over a 24px backdrop blur) with a hairline and the material shadow. In Review the filters, legend and zoom islands fade, shift down and leave the accessibility tree, and return when Review is left. Top-left: the product name and the view switch (Layers, Matrix, Review). Below it, a 200px filters island holds the facet filters (chips with an "All" chip per group, layers with the layer pictogram and its count, domains, concerns), a clear-filters button when any filter is set and, in the Layers view, the collapsed "Concepts and relations" list; its header button collapses it to a single line. Top-right: the live line of shown counts and, when files failed to parse, a problems disclosure. Bottom-left: the wire legend. Bottom-right, in the Layers view: the zoom group (zoom out, the current percentage, zoom in, Fit).

The free area is what no island covers: from the right edge of the filters island (or 16px from the window when it is collapsed) to 16px from the right edge, and from below the top islands to above the legend and zoom islands on the bottom edge. The plates sit in the free area and grow downward, never sideways, so the view pans vertically. The matrix sits in the free area and the review card is centered in it. The concept drawer is a 420px sheet fixed to the right edge, 16px from the window, floating over the canvas; while it is open the counts and zoom islands slide left of it, the free area's right edge moves left of it, and the camera glides to frame the selected concept and its neighbours inside what is left, never zooming below Fit and never past twice Fit. When the neighbourhood is taller than the free area at Fit it cannot be shown whole, and the selected concept is kept inside instead.

**The Fit Floor Rule.** The plates are drawn at the Fit scale, min(1, free width / projected width), so they never scroll sideways; the free width is the window width less the filters island and the 16px margins, so collapsing or expanding the island refits. Below 0.85, the scale at which 13px labels fall under 11px or 44px pictograms under 32px, the view is refused and replaced by the fit message, which states the scale it would need, the free width and the floor, and asks for narrower filters. The matrix cannot shrink: it is refused by width, stating the needed and available pixels.

Zoom runs continuously from Fit to 3 times Fit. Ctrl (or Cmd) with the wheel, or a trackpad pinch, zooms around the pointer; the zoom group steps through 1, 1.5, 2 and 3 times around the centre of the free area, from whatever the current zoom is. It never goes below Fit. The view pans at every zoom, Fit included, by dragging the empty canvas or with the wheel, and a released drag slides on with inertia; it is clamped so at least 80px of the scene stays inside the free area. Keyboard focus moving to a concept outside the free area shifts the view just enough to bring it in. A click on empty canvas clears the selection.

Spacing comes from a 4px step: 4, 8, 12, 16, 20, 24. Filters groups sit 20px apart; panels pad 16px, the review card 24px.

**The Board Grid Rule.** Inside the board nothing is placed by hand and nothing is routed by the board. All shown concepts go into one elk layered graph, top to bottom, partitioned by layer so each layer keeps its own band of ranks; elk places every cell and computes every orthogonal route and every label position, within a plate and between plates, and the board only projects that plane onto the plates. A concept takes a fixed cell of 190 by 208 plate units (its 79px screen height divided by the 0.38 squash), its pictogram's ground point at 46% of the cell height from the top; cells sit 24 apart within a rank and 64 apart between ranks, and wires keep 14 from cells within a rank and 28 from cells and from each other between ranks, and 40 from each other within a rank, so parallel wires that overlap for more than 20px stay at least 10px apart on screen. Each layer also has a mark cell of the same size carrying its pictogram and caption, placed by elk like a concept, so no wire crosses it. A layer's band runs from its first to its last cell, padded by 20 units (the last 4 so that a wire's first drop off the plate edge is not a stub under 8px); the plate is that band and nothing of the gap belongs to it, and no wire lies within 3px of a plate edge for more than 35px. A band point (u along, v down from the band's top) is projected onto its plate at x = u − 0.25v and y = plate offset + 0.38v; the screen gap between two plates is not a mapping of elk's gap but is sized by the wires that cross it, max(64, 2 x 20 + (n - 1) x 12) px for n crossing wires. A wire that changes plates drops: it leaves the front edge of its plate along a screen-vertical segment, runs along its own horizontal lane, and drops onto the back edge of the next plate along another. Lanes are 12px apart, the first 20px below the front edge, and keep the order of the horizontal runs elk routed in that gap; a wire whose elk route crosses the gap straight still gets a lane. A wire that passes over a plate on its way keeps the route elk gave it there. Wires leave a concept at the bottom border of its cell and enter the target at the top border; jogs under 9px left by the squash are dropped, and the arrowhead follows the last segment, slanted or not. Each wire carries an elk label as wide as its chip plus the shear times its height (height divided by the squash in plate units) and set inline on the wire, so slanted neighbours stay clear of the chip; the chip is drawn upright at the projected centre of elk's label box, or on the wire's lane when that centre falls in a gap. For every layer filter the scene checks require that no wire crosses a concept or a mark that is not one of its ends, no two wires share a line, parallel wires that overlap for more than 20px are 10px or more apart, no wire lies along a plate edge for more than 35px or crosses a label, cross-layer wires drop straight through the gap onto lanes at least 10px apart, every label is nearer its own wire than any other, and no segment is under 8px.

The matrix is a fixed grid: a 220px row header, 32px square cells, 160px column headers with vertical titles, ordered client, network, server, data.

## Elevation & Depth

Depth on the board comes from the projection: plates are flat faces sheared into a fixed oblique view and stacked top to bottom, and each pictogram is a small isometric solid whose three faces are shaded from its layer key. The interface has one level of elevation, used by everything that floats over the canvas.

### Shadow Vocabulary
- **Material** (`box-shadow: 0 0 0 0.5px rgb(0 0 0 / 0.06), 0 2px 6px rgb(0 0 0 / 0.05), 0 12px 32px -12px rgb(0 0 0 / 0.22)` in light; `0 0 0 0.5px rgb(255 255 255 / 0.08), 0 12px 32px -10px rgb(0 0 0 / 0.7)` in dark): the islands, the concept drawer and the review card, which are translucent.
- **Floating** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the opaque popovers (relation tooltip, problems panel). Resting panels (matrix, fit message) carry a hairline and no shadow.
- **Ground** (a flat ellipse, 38 by 19 units at the pictogram's foot, black at 8% in light and 45% in dark): the only shadow on the board. It seats each pictogram on its plate.

### Named Rules
**The Flat Plate Rule.** Plates have no thickness, no shadow and no gradient: a 7% layer tint and a 55% layer-colored edge. The only shadow on the board is each pictogram's own flat ground ellipse, with two exceptions: a hovered concept rises 3px, and the selected concept lifts 6px, grows 12%, takes a soft drop shadow and a 16% layer-colored halo, and its label goes to weight 600. Nothing else on the board is blurred, lifted or given a drop shadow. A concept stands out by its shaded faces and outline, and the selection by its lift.

**The Recede Rule.** While a concept is selected, its relations and the concepts they connect stay at full opacity; every other concept, wire, chip and plate (and in the matrix every cell outside the selected row and column) drops to 18%. Receded things stay in the tab order and return to 70% on hover or focus so they can still be read and chosen.

## Shapes

**The Soft Frame, Hard Board Rule.** Interface panels, controls and inputs use rounded corners: 16px for islands, 24px for the drawer and the review card, 12px for floating and grouping elements (popover, view switch, fit message), 8px for buttons, view segments and zoom buttons. Plates, wires, matrix cells and swatches use sharp corners and 1px lines. A rounded plate or a square button breaks the rule.

Plates are parallelograms: rectangles sheared by 0.25 and squashed to 0.38 of their depth. Wires end in a closed arrowhead (9px) in the wire's own color, oriented along the last segment. Hover or keyboard focus thickens a wire from 1px to 2.5px.

**The Isometric Grid Rule.** Every pictogram is drawn on one 48-unit grid, shown at 44px, standing on a ground point at (24, 40). Solids use 2:1 isometric faces (slope 0.5); cylinders use ellipses at a 2:1 ratio. Each solid shows a top, a left and a right face, filled from the layer key: in light mode the key mixed at 16%, 45% and 80% into white; in dark mode at 80% into white for the top and 72% and 42% into black for the left and right. Outlines and detail lines are 1px (emphasized strokes 1.75px) in the pictogram outline color, with round joins, and never scale with zoom. Pictograms are never sheared with the plate.

## Components

### Buttons
- **Shape:** gently rounded (8px).
- **Primary:** ink fill with inverse text, 6px by 12px. Used for the forward step of a flow (Show answer, Next).
- **Secondary:** hairline border, ink text, canvas fill on hover. Used for Right, Wrong, Open concept.
- **Quiet:** hairline border, muted text turning ink on hover, 4px by 10px. Used for Clear filters.
- **Round:** the drawer's Close, a 28px circle with an 8% ink fill and a muted glyph, no border; the fill deepens to 14% on hover.
- **Press:** every pressable control scales to 95% for 200ms on press; the zoom buttons, list and matrix row and cell buttons, the filters toggle and the disclosure summaries included.
- **Disabled:** 60% opacity while a request is in flight.

### View Switch
- **Style:** a 12px-rounded group on the canvas gray inside the top-left island, 4px inner padding. A thumb (8px radius, ink fill) slides under the segments on the spring and the active label turns to inverse text; inactive segments are muted text that turns ink on hover. State is exposed with `aria-pressed`.

### Zoom Group
- **Style:** in its own bottom-right island, 28px hairline buttons with 8px radius and 13px text (zoom out, zoom in, Fit; zoom out is disabled at Fit and zoom in at 3 times), canvas fill on hover, muted text when disabled at either end of the steps. Between them the current on-screen scale (Fit scale times zoom step) in muted 13px tabular figures, such as "96 %".

### Filters Island
- **Style:** 200px, 16px radius, hairline border, translucent panel material, material shadow, 12px padding; its header button collapses it. Each group is a fieldset with an uppercase label heading and a wrapping row of pill chips: an "All" chip, pressed (ink fill, `aria-pressed`) while nothing in the group is chosen and clearing the group when pressed, then one chip per value, each a `checkbox` named by its value and ink-filled when chosen. Layer chips carry the layer pictogram at 20px and the layer's concept count in tabular figures. Semantics are unchanged: choosing nothing means all.

### Wire Legend
A single-row island at the bottom-left of toggle buttons: a 20px line sample per code at 2px stroke, the letter code in muted label weight, then the type name; the last entry is graphite "any other type" in muted ink. Each entry is a button with `aria-pressed`, 10px radius, a 6% ink wash on hover and 10% when pressed (the letter code and the muted "any other type" turn to full ink while hovered or pressed so they keep AA); while a type is active the line samples of the other entries dim to 40% and their text stays at full contrast.

### Problems
A disclosure in the top-right island, shown only when files failed to parse: its summary counts the files; opened, a panel lists each file name in 500 weight with its reason in muted ink.

### Plate (signature)
A flat parallelogram per layer, tinted with its key at 7% and edged in the key at 55%. Its layer pictogram stands in the mark cell elk placed for it, with the plate label centered beneath it ("CLIENT 6 shown"). An empty plate is as deep as its mark cell and sets muted "no concepts shown" at three quarters of its width, halfway down. Each plate is exposed as an image whose name gives the layer, the shown count and the pictogram's meaning.

### Concept Object (signature)
A 44px isometric pictogram from the catalog standing on its plate, with its ground shadow, and a two-line board label below it in screen space: the designator in the layer key, then the title. A concept whose pictogram is missing or not in the catalog falls back to its layer's pictogram. The tooltip reads designator, title and the pictogram's meaning. The whole object is a button that opens the concept sheet with click, Enter or Space. Keyboard focus draws a 2px ink ellipse (64 by 32px) around the foot; hover draws the same ellipse at 1px.

### Wire (signature)
A 1px path in its wire code with a closed 9px arrowhead and a 13px label on a canvas-colored chip set on the wire where elk placed the label; chips are drawn above the concepts. The label is always kept, even on coded wires. A 14px invisible stroke widens the hit area. Hover or focus previews the relation popover; click, Enter or Space pins it. Keyboard focus also shows the hit stroke in ink at 18%.

### Concept List
A native disclosure at the bottom of the filters island, closed by default: "Concepts and relations (N concepts, M relations)" in 500. Open, it lists every concept by layer as an underlined button (hairline underline turning ink on hover) that opens the sheet, followed in muted ink by its layer and pictogram meaning, with its outgoing relations nested beneath. It carries everything the plates show, as text, for keyboard and screen reader use.

### Fit Message
A 12px-rounded hairline panel with 16px padding and 13px text, announced as a status, that replaces a view which cannot be drawn readably. For the plates it gives the scale needed, the free width and the 85% floor; for the matrix the needed and available widths. Both end by asking for fewer layers, domains or concerns.

### Matrix Swatch
A square swatch 16px high and at least 24px wide, centered in its cell. A single coded relation fills it with the wire color and shows its letter code in the board color; `alternative to` is a dashed graphite outline with the code in ink; a single uncoded relation is a plain graphite fill; several relations show their count.

### Relation Popover
A 320px tooltip, 12px radius, hairline, floating shadow. It shows the type with from and to, the source and the explanation; several relations stack with hairline separators. It opens below its anchor and flips above when the window would cut it off.

### Concept Sheet
A 420px non-modal dialog fixed to the right edge, 24px radius, translucent material with the material shadow, scrolling internally. Its header is washed 10% with the layer color and holds the concept's pictogram at 64px, a layer-tinted pill with the designator and the layer, the title and its facets as pills, and a round Close control. Grouped cards follow: SEE-I; relations split into outgoing and incoming, each row giving source, type and target with its source citation and explanation, and activating a row selects the other end, which moves focus to the drawer; episodes; and recall questions with box and due date. Escape, Close or a click on empty canvas clears the selection and focus returns to the concept, list row or matrix row that opened it.

### Review Card
A centered card of up to 672px, 24px radius, 24px padding, translucent material, with a 4px progress bar above it (answered of due today). It shows the question in headline weight and keeps the answer unrendered until revealed. Space or Enter reveals with a flip; under reduced motion the flip is a fade. After the reveal 1 marks Wrong and 2 marks Right, the buttons show their keys, and focus lands on Right. The answered card leaves up and to the left and the next one rises in. A wrong mark is the one place correction red appears in a normal flow.

### Motion
- **Re-place on filter change:** concepts glide to their new positions over 320ms on `cubic-bezier(0.16, 1, 0.3, 1)`. Wires and their chips fade out over 80ms (linear) during the settle and return over 180ms on the same curve.
- **Entrances:** new concepts fade in over 220ms; the drawer slides 12px in from the right on the spring over 420ms; the popover fades over 120ms; a revealed answer flips in over 550ms on the spring. All use backwards fill so nothing flashes before it starts.
- **Camera:** zoom, Fit, framing and the return on clear glide on a damped spring (about 0.6% overshoot, settled inside 600ms). Dragging and the plain wheel follow the pointer with no delay.
- **Selection:** the lift rises and grows over 420ms on the spring while its drop shadow and the halo fade in over 300ms on the ease-out curve; receding fades over 320ms on the ease-out curve; the wires of the neighbourhood draw on from source to target over 560ms.
- **Chrome:** the view-switch thumb slides over 380ms; the filters, legend and zoom islands step away in Review over 300ms and 400ms (fade, 8px down, 4% smaller).
- **Reduced motion:** camera moves are instant and drags do not slide on; the lift, draw-on, flip, thumb slide, press response and islands' step-away are dropped; no wire hiding; the drawer, the review card and the answer reveal become plain fades.

## Do's and Don'ts

### Do:
- **Do** keep every color with meaning inside the board; the wire legend island is the only exception.
- **Do** give every motion a reason the author can name: re-place, enter, select or move the camera.
- **Do** use the ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`) for fades and re-place, the spring for lift, camera, flip, thumb and islands, and backwards fill on entrances.
- **Do** design light and dark together, remapping roles onto the same gray ramp.
- **Do** keep a label on every wire, including coded ones.
- **Do** draw the plates at the Fit scale and replace them with the fit message below 0.85; replace the matrix with the fit message when it is wider than the free area. Neither view scrolls sideways.
- **Do** draw a new pictogram on the 48-unit isometric grid with three key-shaded faces, a 1px outline and the ground ellipse at (24, 40), and add it to the catalog with a one-line meaning.
- **Do** check every new color pair for WCAG 2.2 AA in both modes.

### Don't:
- **Don't** make the board look like draw.io, Mermaid or a free-floating node graph: no dragging concepts, no zoom below Fit and none past 3 times Fit.
- **Don't** make the interface look like a generic SaaS dashboard of cards and charts.
- **Don't** let color be the only carrier of meaning.
- **Don't** give a free-text relation type its own hue; only `requires`, `complements` and `contains` are coded.
- **Don't** round a plate, wire or matrix cell, and don't give anything on the board a shadow other than a pictogram's ground ellipse and the lifted selection.
- **Don't** shear or squash text or pictograms with the plate; only their anchor points are projected.
- **Don't** introduce a second font family or a gray outside the ramp.
