---
name: arch-mind
description: A personal architecture study tool whose diagrams read like a wiring harness inside a calm, Apple-like neutral interface.
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
  wire-label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
rounded:
  board: "0px"
  control: "8px"
  floating: "12px"
  panel: "16px"
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
  sidebar:
    backgroundColor: "{colors.gray-0}"
    rounded: "{rounded.panel}"
    padding: "16px"
    width: "200px"
  concept-sheet:
    backgroundColor: "{colors.gray-0}"
    rounded: "{rounded.panel}"
    padding: "16px"
    width: "420px"
  relation-popover:
    backgroundColor: "{colors.gray-0}"
    rounded: "{rounded.floating}"
    padding: "12px"
    width: "320px"
  connector:
    backgroundColor: "{colors.gray-0}"
    typography: "{typography.body}"
    rounded: "{rounded.board}"
    padding: "0 10px"
    width: "176px"
    height: "48px"
  matrix-cell:
    rounded: "{rounded.board}"
    size: "32px"
---

# Design System: arch-mind

## Overview

**Creative North Star: "The Wiring Harness"**

**The Harness Thesis.** Every diagram is a wiring harness board: concepts are connectors, relations are wires whose color code names the relation type, and the four layers (client, network, server, data) are harness zones stacked top to bottom. Around the board sits a quiet, Apple-like neutral interface that never competes with it.

Two languages share each screen on purpose. The interface is soft: rounded panels and controls, generous spacing, neutrals from one gray ramp. The board is exact: square connector blocks, 1px hairlines, orthogonal wires with a label on every one. The contrast is the identity, not an accident.

Motion explains what changed. When a filter changes, the connectors glide to their new places while the wires, whose routes were recomputed, step aside and come back once the connectors have settled. Sheets, popovers and revealed answers enter briefly and never bounce. All motion uses one ease-out curve; there is no spring. Under reduced motion the glide is dropped and every entrance becomes a plain fade.

The interface runs in light and dark mode with equal care; neither is the default. The mode follows the operating system (`prefers-color-scheme`); there is no in-app toggle.

**Key Characteristics:**
- One 11-step gray ramp, remapped by role for dark mode; no other grays.
- Near-black ink as the only action color in light mode, near-white in dark mode.
- Meaningful color only inside the board: layer keys on zones and designators, three wire hues.
- Inter only; tabular figures only where numbers are compared.
- Rounded interface, square board; one soft shadow for floating layers, a flat board.
- Deferred by the author's decision, not built: chain tracing, the trace pulse, the pin table and splice dots.

## Colors

A neutral interface from one gray ramp, with hue reserved for the board and for correction.

### Primary
- **Ink Action** (`{colors.gray-9}` in light, `{colors.gray-1}` in dark): the single action color. It fills the primary button and the active view segment, draws the 2px focus ring (offset 2px) and tints checkboxes. It is the same value as body text; pressability is carried by the filled shape, not by a hue.

### Secondary
- **Correction Red** (`{colors.correction-red}` / `{colors.correction-red-dark}`): only for load errors, failed requests and a review answer marked wrong. Never decorative, never a hover state.

### Tertiary
- **Layer Keys** (`{colors.layer-client}`, `{colors.layer-network}`, `{colors.layer-server}`, `{colors.layer-data}` and their `-dark` mirrors): client blue, network teal, server amber-brown, data violet. They color the zone name, the zone tint (the key mixed at 7% into transparent), the connector border and the connector designator, and the designators in the matrix headers.
- **Wire Code** (`{colors.wire-requires}`, `{colors.wire-complements}`, `{colors.wire-contains}` and their `-dark` mirrors): magenta for `requires`, green for `complements`, olive-gold for `contains`. Only these three exact core verbs (matched after trimming, lowercasing and collapsing spaces) get a hue. Each carries a short code: `rq`, `cp`, `ct`.
- **Graphite Wire** (`{colors.gray-7}` in light, `{colors.gray-4}` in dark): every other free-text relation type. `alternative to` is drawn in graphite dashed (5 on, 4 off) with the code `alt`, because an alternative is not a dependency and does not earn a fourth hue.

### Neutral
- **Canvas** (`{colors.gray-1}` light / `{colors.gray-10}` dark): page background behind panels and the board.
- **Panel and Board** (`{colors.gray-0}` light / `{colors.gray-9}` dark): sidebar, sheet, popover, review card and the board surface; also the wire-label background.
- **Hairline** (`{colors.gray-3}` light / `{colors.gray-7}` dark): every 1px border, zone edge and matrix grid line.
- **Ink** (`{colors.gray-9}` light / `{colors.gray-1}` dark): body text.
- **Muted Ink** (`{colors.gray-6}` light / `{colors.gray-4}` dark): secondary text, section labels, counts, inactive view segments.
- **Scrollbar** (`{colors.gray-4}`): the only use of step 4 in light mode.

### Named Rules
**The Quarantine Rule.** Meaningful color lives only inside the board. Everything outside it is neutral, plus the ink action color for what can be pressed and correction red for what went wrong. The one deliberate exception, chosen by the author, is the sidebar wire legend: its swatches repeat the wire code so the code can be read without hovering a wire. No other color leaves the board.

**The Double Carrier Rule.** No meaning rides on color alone. Every wire keeps its free-text label, every coded matrix swatch shows its letter code, every zone shows its name, every designator spells its layer initial.

Measured contrast, both modes: text at or above 4.66:1, focus ring at or above 15:1, wires on tinted zones at or above 4.45:1, matrix swatch codes at or above 4.92:1.

## Typography

**Display Font:** none
**Body Font:** Inter Variable (with ui-sans-serif, system-ui, sans-serif)

**Character:** One neutral grotesque for interface and board alike; hierarchy is size and weight on a small, tight scale.

### Hierarchy
- **Title** (600, 17px, tracking -0.025em): sheet and review headings.
- **Headline** (600 or 500, 15px): the product name in the header (600, tight tracking) and the current review question (500).
- **Body** (400, 13px, line-height 1.5): all interface text, connector titles (tight leading, clamped to two lines), popover and sheet content. Emphasis inside body uses 500 or 600, never a size change.
- **Label** (600, 11px, tracking 0.1em, uppercase): section headings in the sidebar, sheet and review, and zone names on the board (zone names take their layer key color).
- **Designator** (600, 11px, tabular figures): connector and matrix designators such as C1, N3, colored by layer key.
- **Wire Label** (400, 11px): relation type on every wire, on a board-colored chip padded 4px by 2px.

### Named Rules
**The One Face Rule.** Inter carries the whole product, interface and board alike. Hierarchy comes from size and weight, never from a second family.

**The Tabular Figures Rule.** Tabular figures apply only where numbers are compared: designators, counts (concepts, relations, shown, board use, due, question position, box) and dates. Prose stays proportional.

## Layout

The study screen is centered at a maximum of 1366px with 16px outer padding and 12px gaps. A header line carries the product name left and the corpus counts right. Below, a 200px rounded sidebar on the left holds facet filters (layers, domains, concerns), a clear-filters button when any filter is set, the wire legend, and unreadable files when there are any. The board fills the rest of the width under a view switch (Layers, Matrix, Review) and a live line of shown counts and board use.

Zones stack vertically so the board grows downward, never sideways. A view whose natural width exceeds the board does not scroll and does not scale: it is replaced by a fit message stating the needed and available widths and asking for narrower filters. The concept detail is a 420px sheet fixed to the right edge, 16px from the window, floating over the board; there is no permanent right column.

Spacing comes from a 4px step: 4, 8, 12, 16, 20, 24. Sidebar groups sit 20px apart; panels pad 16px, the review card 24px.

**The Board Grid Rule.** Inside the board nothing is placed by hand. elk's layered algorithm lays connectors out top to bottom, partitioned by layer, with fixed measures (24px between connectors, 64px between ranks, 16px board margin). Every connector has the same footprint and every wire runs only horizontally and vertically. Zones hug their connectors (30px above, 14px below, 12px between zones); a layer with nothing shown keeps a 28px zone reading "no concepts shown", and everything below shifts down by whole zones so wires stay orthogonal. Wire labels are placed along the longest segments first, at the first spot that clears every connector, the wire's own bends and every label already placed. There is no snapping lattice beyond these measures.

The matrix is a fixed grid: a 220px row header, 32px square cells, 160px column headers with vertical titles, ordered client, network, server, data.

## Elevation & Depth

The board is flat: no shadows, no cards, depth only from hairlines and the 7% zone tints. The interface has one level of elevation, used only by layers that float above the board.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the concept sheet and the relation popover. Resting panels (sidebar, review card, view switch) carry a hairline and no shadow.

### Named Rules
**The Flat Board Rule.** Nothing inside the board casts a shadow. A connector stands out by its layer-colored hairline, not by lift.

## Shapes

**The Soft Frame, Hard Board Rule.** Interface panels, controls and inputs use rounded corners: 16px for resting panels (sidebar, sheet, review card), 12px for floating and grouping elements (popover, view switch, fit message), 8px for buttons and view segments. The board frame, connectors, zones, wires, matrix cells and swatches use square corners and 1px lines. A rounded connector or a square button breaks the rule.

Wires end in a closed arrowhead (14px) in the wire's own color. Hover or keyboard focus thickens a wire from 1px to 2.5px.

## Components

### Buttons
- **Shape:** gently rounded (8px).
- **Primary:** ink fill with inverse text, 6px by 12px. Used for the forward step of a flow (Show answer, Next).
- **Secondary:** hairline border, ink text, canvas fill on hover. Used for Right, Wrong, Open concept.
- **Quiet:** hairline border, muted text turning ink on hover, 4px by 10px. Used for Close and Clear filters.
- **Disabled:** 60% opacity while a request is in flight.

### View Switch
- **Style:** a 12px-rounded hairline group on panel, 4px inner padding. The active segment is ink-filled with inverse text (8px radius); inactive segments are muted text that turns ink on hover. State is exposed with `aria-pressed`.

### Sidebar
- **Style:** 200px, 16px radius, hairline border, panel fill, 16px padding. Groups are fieldsets with an uppercase label heading and native checkboxes tinted with the action color.
- **Wire legend:** a 20px line sample per code at 2px stroke, the letter code in muted label weight, then the type name; the last row is graphite "any other type" in muted ink.
- **Problems:** file name in 500 weight, reason in muted ink, shown only when files failed to parse.

### Connector (signature)
A square-cornered 176 x 48px block on the board color with a 1px border in its layer key. A layer-colored tabular designator sits left of the title; the title wraps to at most two lines and shows the full text on hover. The whole block is a button that opens the concept sheet.

### Zone (signature)
A full-width band with hairlines top and bottom and the layer key mixed at 7% as fill. The uppercase layer name sits top-left in the key color; an empty zone centers the name with muted "no concepts shown" beside it.

### Wire (signature)
An elk-routed orthogonal path at 1px in its wire code, with a closed arrowhead and an 11px label on a board-colored chip. The label is always kept, even on coded wires. A 14px invisible stroke widens the hit area. Hover or focus previews the relation popover; click, Enter or Space pins it.

### Matrix Swatch
A square swatch 16px high and at least 24px wide, centered in its cell. A single coded relation fills it with the wire color and shows its letter code in the board color; `alternative to` is a dashed graphite outline with the code in ink; a single uncoded relation is a plain graphite fill; several relations show their count.

### Relation Popover
A 320px tooltip, 12px radius, hairline, floating shadow. It shows the type with from and to, the source and the explanation; several relations stack with hairline separators. It opens below its anchor and flips above when the window would cut it off.

### Concept Sheet
A 420px non-modal dialog fixed to the right edge, 16px radius, floating shadow, scrolling internally. It shows the metadata as a two-column definition list, then labeled sections for SEE-I, relations, episodes and recall questions. Escape closes it and focus returns to the connector or row that opened it.

### Review Card
A centered card of up to 672px, 16px radius, 24px padding. It shows the question in headline weight; the revealed answer repeats the sheet's SEE-I and relation sections. A wrong mark is the one place correction red appears in a normal flow.

### Motion
- **Re-place on filter change:** connectors glide to their new positions over 320ms on `cubic-bezier(0.16, 1, 0.3, 1)`. Wires fade out over 80ms (linear) during the settle and return over 180ms on the same curve.
- **Entrances:** new connectors fade in over 220ms; the sheet slides 12px in from the right with a fade over 260ms; the popover fades over 120ms; a revealed answer unclips top to bottom over 240ms. All use backwards fill so nothing flashes before it starts.
- **Reduced motion:** no glide and no wire hiding; the sheet and the answer reveal become plain fades.

## Do's and Don'ts

### Do:
- **Do** keep every color with meaning inside the board; the sidebar wire legend is the only exception.
- **Do** give every motion a reason the author can name: re-place or enter.
- **Do** use the single ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`) for all motion, with backwards fill on entrances.
- **Do** design light and dark together, remapping roles onto the same gray ramp.
- **Do** keep a label on every wire, including coded ones.
- **Do** replace a view that would not fit with the fit message instead of scrolling or scaling it.
- **Do** check every new color pair for WCAG 2.2 AA in both modes.

### Don't:
- **Don't** make the board look like draw.io, Mermaid or a free-floating node graph: no dragging, panning or zooming.
- **Don't** make the interface look like a generic SaaS dashboard of cards and charts.
- **Don't** let color be the only carrier of meaning.
- **Don't** give a free-text relation type its own hue; only `requires`, `complements` and `contains` are coded.
- **Don't** round a board element or put a shadow on one.
- **Don't** introduce a second font family or a gray outside the ramp.
