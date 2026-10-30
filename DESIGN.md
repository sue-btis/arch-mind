---
name: arch-mind
description: A personal architecture study tool whose diagrams read like a wiring harness inside a calm, Apple-like neutral interface.
---

<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Design

## Overview

**The Harness Thesis.** Every diagram is a wiring harness board: concepts are connectors, relations are wires whose color code names the relation type, and the four layers (client, network, server, data) are harness zones stacked top to bottom. Around the board sits a quiet, Apple-like neutral interface that never competes with it.

Two languages share each screen on purpose. The interface is soft: rounded panels and controls, generous spacing, system-like neutrals. The board is exact: square connector blocks, 1px hairlines, orthogonal wires, splice dots, a pin table. The contrast is the identity, not an accident.

Motion explains what changed. Tracing a chain sends a pulse along its wires in order; changing a filter slides connectors to their new zones on a spring; a newly saved concept settles into its zone. Under reduced motion every change jumps straight to its end state.

The interface runs in light and dark mode with equal care; neither is the default.

## Colors

**The Quarantine Rule.** Meaningful color lives only inside the board. Everything outside it is neutral, plus one action color that marks only what can be pressed.

- **Neutrals:** one 11-step gray ramp, mirrored for dark mode; no other grays exist. `[values to be resolved during implementation]`
- **Action:** a single accent for pressable controls and focus. `[to be resolved during implementation]`
- **Layer keys:** one color per layer (client, network, server, data) on zone bands and connector designators. `[values to be resolved during implementation]`
- **Relation-type wire code:** a small fixed set of wire colors, one per core relation type; any other type is drawn in graphite. `[set and values to be resolved during implementation]`
- **Correction red:** reserved for rejections and wrong answers. `[to be resolved during implementation]`

Every color pair is checked for WCAG 2.2 AA contrast in both light and dark mode, and no meaning is carried by color alone: wires also carry their type label, zones their name.

## Typography

**The One Face Rule.** Inter carries the whole product, interface and board alike. Tabular figures for designators, pin tables, counts and dates. Hierarchy comes from size and weight, never from a second family. `[scale to be resolved during implementation]`

## Layout

The study screen is three regions: a rounded sidebar of facet filters on the left, the harness board filling the center, and a narrow pin table for the selected chain on the right. Zones stack vertically so the board grows downward, never sideways: every view fits a 1366 px wide window, and a view that would not fit asks for narrower filters instead of scrolling sideways.

**The Board Grid Rule.** Inside the board everything snaps to one square grid; wires run only horizontal and vertical. `[grid unit to be resolved during implementation]`

## Elevation & Depth

The board is flat: no shadows, no cards, depth only from hairlines and zone tints. The interface may use one subtle level of elevation for panels floating above the board, in the Apple manner. `[exact treatment to be resolved during implementation]`

## Shapes

**The Soft Frame, Hard Board Rule.** Interface panels, controls and inputs use rounded, continuous corners. Connectors, zone bands, wires and the pin table use square corners and 1px lines. A rounded connector or a square button breaks the rule. `[radius values to be resolved during implementation]`

## Do's and Don'ts

- **Do** keep every color with meaning inside the board.
- **Do** give every motion a reason the author can name: trace, re-place, settle.
- **Do** design light and dark together.
- **Don't** make the board look like draw.io, Mermaid or a free-floating node graph.
- **Don't** make the interface look like a generic SaaS dashboard of cards and charts.
- **Don't** let color be the only carrier of meaning.
