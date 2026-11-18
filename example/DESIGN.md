---
name: svelte-whisper example
description: A multilingual transit sign system demonstrating a 1.7 kB Svelte i18n library.
colors:
  ground: "oklch(0.88 0.006 85)"
  panel: "oklch(0.985 0.003 85)"
  ink: "oklch(0.235 0.028 258)"
  ink-2: "oklch(0.42 0.02 258)"
  rule: "oklch(0.78 0.01 258)"
  band: "oklch(0.255 0.035 258)"
  band-ink: "oklch(0.97 0.005 258)"
  band-ink-2: "oklch(0.79 0.018 258)"
  band-rule: "oklch(0.4 0.03 258)"
  band-hover: "oklch(0.34 0.035 258)"
  signal: "oklch(0.86 0.165 94)"
  on-signal: "oklch(0.22 0.03 258)"
  focus: "oklch(0.5 0.17 258)"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 1.5rem + 5.2vw, 5.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1rem + 1.4vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.2
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 0.8vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 1vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  sample:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  detail:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  code:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  tag: "3px"
  plate: "4px"
spacing:
  gutter: "clamp(1rem, 4vw, 3rem)"
  sign-gap: "1.25rem"
  section-gap: "clamp(2rem, 5vw, 3.5rem)"
  plate-inline: "1.5rem"
  field-gap: "0.875rem"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0.45rem 0.9rem"
  button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.plate}"
    padding: "0.55rem 0.75rem"
  sign-legend:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-ink}"
    typography: "{typography.title}"
    padding: "0.875rem 1.5rem"
  sign-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "1.375rem 1.5rem 1.25rem"
  gate:
    backgroundColor: "transparent"
    textColor: "{colors.band-ink}"
    rounded: "{rounded.plate}"
    padding: "0.4rem 0.7rem 0.45rem"
  gate-hover:
    backgroundColor: "{colors.band-hover}"
  gate-active:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
  board:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-ink}"
    rounded: "{rounded.plate}"
    padding: "1.25rem 1.375rem 1.125rem"
  size-tag:
    backgroundColor: "transparent"
    textColor: "{colors.band-ink-2}"
    typography: "{typography.code}"
    rounded: "{rounded.tag}"
    padding: "0.25rem 0.5rem"
---

# Design System: svelte-whisper example

Scope: the demo page in `example/src`. The library's dev overlay (`dev-overlay.js` at the repository root) is a separate surface with its own self-contained dark palette inside a shadow root; it does not use these tokens and nothing here applies to it.

## Overview

**Creative North Star: "The Multilingual Concourse"**

The page is a wayfinding sign system. Every feature is a sign: a flat enamel plate with an ink legend strip on top and a plain field below, identified by a square pictogram, standing on a concrete ground. An ink overhead band carries the wordmark and the language gates. Picking a gate changes every sign at once; that instant switch is what the page exists to show.

Density is calm and legible, not compact. Type does the work: one hyperlegible signage face at heavy weights for legends and figures, its mono sibling for everything a developer would type (codes, bytes, API calls). Color is nearly absent: blue-grey ink, warm concrete, and a single signal yellow that only ever means "you are here".

The world rejects the library-landing default: no gradient hero, no feature-card grid with shadows, no syntax-highlighted code blocks.

**Key Characteristics:**
- Flat enamel plates: ink legend strip over a plain field, 4px corners, no border, no shadow.
- One accent, one meaning: signal yellow marks the active locale and nothing else.
- Signage face for words, mono sibling for code, bytes and calls.
- Line state carries meaning: dashed means "not here yet", solid means "here".
- Direction is logical: arrows and layout mirror in right-to-left scripts.

## Colors

Concrete, blue-grey ink and one enamel yellow; every color is authored in OKLCH, and that is the source of truth.

### Primary
- **Signal Yellow** (`signal`): the active language gate and its pointer notch. The only chromatic color on the page. Text on it uses **Signal Ink** (`on-signal`).

### Neutral
- **Concrete** (`ground`): the page ground behind every plate. Warm, low-chroma grey.
- **Enamel White** (`panel`): the field of every sign, input backgrounds, and the text color of inverted (hovered) buttons.
- **Legend Ink** (`ink`): primary text, button strokes, selection background.
- **Faded Ink** (`ink-2`): secondary prose (lede, details, readout labels, call lines), input strokes, disabled text.
- **Hairline** (`rule`): 1px dividers inside plates, the saved-choice rule, the footer rule; also the disabled button stroke.
- **Overhead Band** (`band`): the header band, every sign's legend strip, and the arrivals board.
- **Band Ink** (`band-ink`) / **Band Ink Faded** (`band-ink-2`): primary and secondary text on band surfaces; `band-ink-2` also draws gate outlines and pictograms in the header and board.
- **Band Rule** (`band-rule`): hairlines on band surfaces (header bottom edge, board rows, size tag).
- **Band Lamp** (`band-hover`): gate hover fill and the board's count tag.
- **Focus Blue** (`focus`): focus outlines, input caret, link hover underline. On band surfaces it is reassigned to `band-ink`.

Dark appearance (`prefers-color-scheme: dark`) remaps ground, panel, ink, ink-2, rule, band, band-rule, band-hover and focus in `app.css`; signal, on-signal, band-ink and band-ink-2 are shared. In dark, the legend strip is lighter than the field it sits on. Always consume the custom properties; never hard-code a light value.

### Named Rules
**The You-Are-Here Rule.** Signal yellow means the active locale. Do not use it for buttons, highlights, success states, badges or decoration. A second yellow element breaks the sign system.

**The Ink-Only Rule.** Everything that is not the active locale is ink, faded ink or concrete. New states are expressed with line style, weight or inversion, not new hues.

## Typography

**Signage Font:** Atkinson Hyperlegible Next Variable (with system-ui, sans-serif)
**Code Font:** Atkinson Hyperlegible Mono Variable (with ui-monospace, monospace)

**Character:** One hyperlegible family in two cuts. The sans is pushed to 700 to 800 for legends and figures the way transit signage is; the mono sibling marks anything literal.

Japanese and Arabic extend `--sans` with native faces (Hiragino/Yu Gothic/Noto Sans JP; Segoe UI/Geeza Pro/Noto Sans Arabic). Arabic zeroes all letter-spacing; Japanese h1/h2 use `word-break: auto-phrase`.

### Hierarchy
- **Display** (800, fluid 2.75 to 5.5rem, 0.98, -0.035em): the greeting only. Balanced wrap.
- **Headline** (500, fluid 1.375 to 2rem, 1.2): the line under the greeting.
- **Title** (700, fluid 1.375 to 1.75rem, 1.2, -0.01em): sign legends, preceded by a pictogram at 1.4em.
- **Figure** (700, fluid 1.5 to 2rem, tabular numerals): formatted values on the readout board. The counter output is the same voice at 2.25rem.
- **Sample** (500, 1.375rem, 1.35; 1.25rem under 40rem): the translated sentence a sign demonstrates.
- **Body** (400, 1.0625rem, 1.5): base text. Lede is 1.125rem/1.55 in faded ink, max 34em.
- **Detail** (400, 0.9375rem, 1.5): explanatory notes in faded ink.
- **Label** (600, 0.875 to 0.9375rem): field labels, buttons, gate names, footer links.
- **Code** (mono, 0.8125rem, 1.5): call lines, readout calls, the size tag. Inline code in details is 0.875rem in full ink. Locale codes on gates are mono 600 at 0.6875rem, uppercase, 0.08em tracking.

### Named Rules
**The Literal-Is-Mono Rule.** If a developer would type it (an API call, a key, a filename, a byte count, a locale code), it is set in the mono cut and marked `dir="ltr"`. Everything a traveller reads is in the sans.

**The Tabular Figures Rule.** Numbers that change or align (counter, readouts, board) use `font-variant-numeric: tabular-nums`.

## Layout

A centered column, max 76rem, with a fluid gutter (`gutter`) on both sides; the header band runs full-bleed. Main stacks sections with `section-gap`.

- **Top:** a two-column grid (1.55fr / min 19rem 1fr): welcome on the start side, arrivals board on the end side. Single column under 60rem.
- **Signs:** a 12-column grid with `sign-gap`. Spans: `half` (6, default), `major` (7), `minor` (5), `wide` (full row). Major/minor relax to 6 under 60rem; every sign goes full row under 44rem, where plate padding tightens to 1.125rem.
- **Readouts:** a three-column board inside a wide sign (label / figure / call) on a shared baseline, rows split by hairlines; one column under 40rem.
- **Header:** wordmark, gates pushed to the inline end, size tag. Under 62rem the gates wrap to their own full-width row; under 30rem they become a 5-column grid with ellipsized names.

All inline positioning is logical (`margin-inline-start`, `inset-inline-start`, `text-align: start`) so the page mirrors in Arabic.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth is tonal: band-colored surfaces (header, legend strips, board) against enamel-white fields against concrete ground. Separation inside a plate is a 1px hairline; the only motion-borne emphasis is the board's arrival flash.

### Named Rules
**The Enamel Rule.** Plates are flat: no shadow, no border, no hover lift. If a surface needs separation, change its tone or add a hairline.

## Shapes

Small, uniform corners: 4px (`plate`) on plates, buttons, inputs, gates and the missing-key box; 3px (`tag`) on small tags (size tag, board count). Plates clip their legend strip (`overflow: hidden`).

Line style is semantic: solid strokes for present things, dashed strokes (1.5px) for absent or not-yet-loaded things (unloaded gates, the missing key), and a 1px dashed hairline that separates a sign's call line from its content. Strokes are 1.5px on controls, 1px for rules.

Pictograms are authored SVGs on a 24 by 24 grid, one 1.9 stroke, round caps and joins, `currentColor`, sized in `em`. `arrow` and `detour` mirror horizontally under `dir="rtl"`.

## Components

### Buttons
Outlined ink tags that invert on hover.
- **Shape:** gently squared (`plate`, 4px), 1.5px ink stroke, transparent fill.
- **Default:** label typography at 0.9375rem/600, 0.45rem by 0.9rem padding, optional leading pictogram at 1.125rem with 0.4rem gap.
- **Hover:** fill becomes ink, text becomes panel; 140ms ease-out on color only.
- **Focus:** global 3px focus-blue outline, 2px offset.
- **Disabled:** stroke drops to hairline, text to faded ink, not-allowed cursor.

### Inputs / Fields
- **Style:** enamel-white fill, 1.5px faded-ink stroke, 4px corners, body size; label above in label typography with 0.375rem gap, max 20rem wide.
- **Focus:** stroke darkens to ink, outline sits flush (offset 0), caret is focus blue.

### Navigation: Language Gates
The header's locale switcher. Each gate stacks a mono uppercase locale code above the language's own name.
- **Unloaded:** 1.5px dashed `band-ink-2` outline, transparent.
- **Loaded:** the same outline, solid. A gate turns solid once its locale file has actually been downloaded.
- **Hover:** `band-hover` fill. 160ms ease-out on background, border and text color.
- **Active (`aria-pressed`):** signal-yellow fill and border, signal-ink text, with a downward pointer notch at the inline-start edge. This is the you-are-here mark.

### Sign (signature component)
The unit of the page: one feature, one plate.
- **Legend strip:** band fill, band-ink title typography, pictogram at 1.4em, 0.75rem gap.
- **Field:** panel fill, content in a grid with `field-gap`.
- **Call line:** optional; mono code in faded ink under a 1px dashed hairline, always LTR. It shows the exact call that produced what the sign displays.
- **Corners / depth:** 4px, flat, no border.

### Arrivals Board (signature component)
The download log, styled as a departures board on a band-colored plate.
- Heading in 700/1.0625rem with a faded pictogram and a mono count tag (`band-hover` fill, 3px corners) pushed to the inline end.
- Table in mono 0.875rem with tabular numerals; rows split by `band-rule` hairlines; first column start-aligned, numeric columns end-aligned. Column heads are sans 600 at 0.6875rem, uppercase with 0.06em tracking, a board-only device.
- New rows arrive with a 1.6s `cubic-bezier(0.16, 1, 0.3, 1)` flash from 22% band-ink; reduced motion collapses it.

### Absent marker
A missing value shown as its raw key in mono inside a 1.5px dashed faded-ink box with 4px corners. Use it whenever the page shows something that is not there.

## Do's and Don'ts

### Do:
- **Do** build every new feature as a Sign: pictogram plus title in the legend strip, a sample sentence, a detail, and the call that produced it.
- **Do** draw any new pictogram on the 24 by 24 grid with one 1.9 stroke and round caps, in `currentColor`; mirror it in RTL if it points.
- **Do** use dashed strokes for absent or not-yet-loaded states and solid for present ones.
- **Do** set every literal (calls, keys, filenames, bytes, codes) in the mono cut with `dir="ltr"`.
- **Do** use logical properties so layout mirrors in Arabic, and test in dark appearance.
- **Do** keep transitions to color properties at 140 to 160ms ease-out, and honor reduced motion.

### Don't:
- **Don't** use signal yellow for anything but the active locale.
- **Don't** add shadows, borders or hover lifts to plates.
- **Don't** add a gradient hero, a feature-card grid, or syntax-highlighted code blocks.
- **Don't** number the signs.
- **Don't** apply letter-spacing to Arabic text.
- **Don't** introduce icon fonts or glyph icons; pictograms are authored SVG.
