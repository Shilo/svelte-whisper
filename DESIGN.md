---
name: svelte-whisper editor
description: A multilingual postal declaration form for editing locale files and sending them back to the repository.
colors:
  form-ink: "oklch(0.43 0.075 165)"
  airmail-blue: "oklch(0.5 0.16 258)"
  airmail-blue-deep: "oklch(0.44 0.16 258)"
  airmail-paper: "oklch(0.99 0.005 258)"
  alert-red: "oklch(0.52 0.19 27)"
  alert-wash: "oklch(0.96 0.03 27)"
  postal-paper: "oklch(0.968 0.014 165)"
  postal-paper-band: "oklch(0.935 0.022 165)"
  entry-box: "oklch(0.995 0.003 165)"
  source-box: "oklch(0.952 0.018 165)"
  rule-hair: "oklch(0.83 0.035 165)"
  rule-strong: "oklch(0.6 0.06 165)"
  entry-ink: "oklch(0.23 0.018 170)"
  entry-ink-soft: "oklch(0.44 0.02 170)"
  scrim: "oklch(0.2 0.02 170 / 0.45)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  ui:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\""
  small:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  key:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Segoe UI Mono', Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
rounded:
  box: "2px"
  none: "0px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  bar: "3.25rem"
components:
  button:
    backgroundColor: "{colors.entry-box}"
    textColor: "{colors.entry-ink}"
    rounded: "{rounded.box}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-hover:
    backgroundColor: "{colors.postal-paper-band}"
  button-send:
    backgroundColor: "{colors.airmail-blue}"
    textColor: "{colors.airmail-paper}"
    rounded: "{rounded.box}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-send-hover:
    backgroundColor: "{colors.airmail-blue-deep}"
  button-solid:
    backgroundColor: "{colors.form-ink}"
    textColor: "{colors.entry-box}"
    rounded: "{rounded.box}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-solid-hover:
    backgroundColor: "{colors.entry-ink}"
  button-quiet:
    textColor: "{colors.form-ink}"
    rounded: "{rounded.box}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-quiet-hover:
    backgroundColor: "{colors.postal-paper-band}"
  input:
    backgroundColor: "{colors.entry-box}"
    textColor: "{colors.entry-ink}"
    rounded: "{rounded.box}"
    padding: "0.5rem 0.625rem"
    height: "2.5rem"
  grid-cell:
    backgroundColor: "{colors.entry-box}"
    textColor: "{colors.entry-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.6rem 0.75rem"
  grid-cell-source:
    backgroundColor: "{colors.source-box}"
  key-cell:
    backgroundColor: "{colors.postal-paper}"
    textColor: "{colors.form-ink}"
    typography: "{typography.key}"
    width: "15rem"
  language-chip:
    textColor: "{colors.entry-ink-soft}"
    rounded: "{rounded.box}"
    padding: "0 0.625rem"
    height: "2rem"
  language-chip-pressed:
    backgroundColor: "{colors.entry-box}"
    textColor: "{colors.entry-ink}"
  edit-tag:
    textColor: "{colors.airmail-blue}"
    typography: "{typography.caption}"
    padding: "0 0.3rem"
  app-bar:
    backgroundColor: "{colors.postal-paper-band}"
    height: "{spacing.bar}"
  dialog:
    backgroundColor: "{colors.entry-box}"
    textColor: "{colors.entry-ink}"
    rounded: "{rounded.box}"
    width: "min(30rem, calc(100vw - 1.5rem))"
  dialog-header:
    backgroundColor: "{colors.postal-paper-band}"
    typography: "{typography.title}"
    padding: "0.5rem 0.5rem 0.5rem 1.25rem"
---

# Design System: svelte-whisper editor

## Overview

**Creative North Star: "The Declaration Form"**

The editor is a multilingual postal declaration form, in the CN22/CN23 family. Everything the form prints, its rules, captions, key names and column headers, is in one green form ink on a pale tinted ground. Everything the user writes sits in white boxes in near-black entry ink. Sending is an act you sign: the review step reads as an itemised declaration that ends in the send action. Density is that of a working form: tight, ruled and tabular, with no decorative space and no cards.

Structure comes from 1px rules alone. Corners are square, or at most 2px. Nothing floats except overlays. States are printed marks, not fills: a dotted baseline means missing, a folded blue corner means edited, a red underline means a placeholder mismatch, a diagonal hatch with a strike means deleted, and a dashed outline means disabled. The world rejects the category default of a grey SaaS data grid with a coloured primary button and rounded cards. It also rejects the Material 3 dark look the editor used before.

Light and dark are both full worlds, chosen by `prefers-color-scheme`. In dark mode the paper becomes a deep green-black, the form ink lifts to a pale green, and airmail blue lightens. Every token is redeclared, so no colour is inverted mechanically.

**Key Characteristics:**
- Two inks: green form ink for printed structure, near-black entry ink for what the user writes.
- Airmail blue means "your edit" and "send", and nothing else.
- 1px rules, 2px maximum corner, no elevation outside overlays.
- States are printed marks on the box, never coloured fills.
- System sans for everything, monospace for keys. No web fonts.

## Colors

A restrained palette: one green ink across a tinted paper family, plus two signal colours, each with exactly one job.

### Primary
- **Form Ink** (form-ink): the colour of everything the form prints. Captions, key names, language codes, file names in the review manifest, links, the selected state of segmented controls and send options, the solid button, the focus ring and text selection (22% mix). It is the colour the user reads as "the form itself".

### Secondary
- **Airmail Blue** (airmail-blue): reserved for the user's own edits and for sending. It is used for the folded-corner tick on edited cells and the status bar, the EDITED label on phone cells, NEW and RENAMED key tags, the underline under after-values in the review diff, and the filled button on the send path ("Review & send" in the status bar, then the final send). **Airmail Blue Deep** (airmail-blue-deep) is its hover state. **Airmail Paper** (airmail-paper) is the text on a blue fill.

### Tertiary
- **Alert Red** (alert-red): used only for errors and placeholder mismatches. It covers the inset underline on a mismatched cell, warning text, the strike colour on deleted keys and removed values, error toasts, the load-error band and the danger button text. **Alert Wash** (alert-wash) is the background of an error toast or load-error band, always paired with an alert-red border or rule.

### Neutral
- **Postal Paper** (postal-paper): the page ground, the sticky key column and dialog footers.
- **Paper Band** (postal-paper-band): the printed header bands (app bar, status bar, grid column headers, dialog and panel headers, file headers in the manifest) and the hover fill on buttons.
- **Entry Box** (entry-box): the white boxes the user writes into, plus inputs, dialogs, toasts and the default button face. Text on a solid form-ink button also uses it.
- **Source Box** (source-box): the source-language column. It is a box the user can read and still edit, slightly tinted toward the paper.
- **Hair Rule** (rule-hair): the 1px rules between cells, list rows and segments, and the hatch lines on a deleted row.
- **Strong Rule** (rule-strong): box outlines, header band edges, the key column's right edge, dashed separators, the dotted missing baseline and the double rule under the totals.
- **Entry Ink** (entry-ink): the user's text and all headings. It is near-black and never pure black.
- **Soft Ink** (entry-ink-soft): hints, counts, placeholders, before-values, disabled text and unpressed chips.
- **Scrim** (scrim): the dialog backdrop.

### Named Rules
**The Airmail Rule.** Airmail blue marks only the user's edits and the send path. If something is blue, it is something you changed or the button that sends it. Do not use it for links, focus, selection, navigation or emphasis.

**The Two Inks Rule.** The form prints in green and the user writes in near-black. Printed furniture never uses entry ink as decoration, and user content never uses form ink.

**The Red Means Wrong Rule.** Red appears only when something is broken: an error, a placeholder mismatch, or a deletion. A wash is never used without its red rule beside it.

## Typography

**Body Font:** the system sans stack (`system-ui`, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial)
**Label/Mono Font:** the system monospace stack (`ui-monospace`, SF Mono, Cascadia Mono, Segoe UI Mono, Menlo, Consolas)

**Character:** Plain official type, as on a printed government form. One sans carries everything, monospace marks machine identifiers, and hierarchy comes from weight and the tracked caption rather than from a second typeface. The product requires a tiny static bundle, so there are no web fonts. Numerals are tabular throughout.

### Hierarchy
- **Display** (600, clamp 1.5rem to 2.5rem, line-height 1.1, -0.025em): only the sign-in statement.
- **Headline** (600, 1.5rem, line-height 1.1): the boxed numbers in the review totals.
- **Title** (600, 1.125rem, -0.01em): dialog, panel and empty-state headings. Headings balance their wrap.
- **Body** (400, 0.9375rem, line-height 1.45): translation text in grid cells and monospace inputs. On phones, cells and inputs rise to 1rem so iOS does not zoom.
- **UI** (400, 0.875rem, line-height 1.45): the base size for controls, toolbar text, buttons (weight 500) and toasts.
- **Small** (400, 0.8125rem): hints, counts, warning text and diff metadata.
- **Caption** (600, 0.6875rem, 0.08em tracking, uppercase, form ink): the printed label above a box. It is used for field labels, the totals' terms, the grid's Key header, and the Declaration and Sender marks.
- **Key** (monospace, 0.8125rem, 600 leaf, line-height 1.45, form ink): translation keys. The dotted prefix is 400 weight at 0.72 opacity and the leaf is bold, so the eye lands on the segment that differs.

### Named Rules
**The Caption Labels a Box Rule.** The uppercase tracked caption is a field label. It sits above or beside the box, term or signature line it names. It is never a decorative line above a heading.

**The Dim Prefix Rule.** Every displayed key splits into a dim regular prefix and a bold leaf. The grid, the review manifest and the sign-in specimen all follow this.

## Layout

The editor fills the full viewport with a fixed column stack: app bar, toolbar, grid and status bar. The app bar and status bar share one height (3.25rem). The grid scrolls on both axes inside its own region. The key column (15rem) and the header band stay sticky, and each language column is at least 13rem wide. A soft edge fade on the right shows when more columns are hidden.

Spacing follows a quarter-rem rhythm (0.25, 0.5, 0.75, 1, 1.25rem), with half-steps (0.375, 0.625rem) for control padding. Toolbars and bars pad at 0.75rem, dialog and panel bodies at 1.25rem, and cells at 0.6rem by 0.75rem.

Below 48rem the grid becomes a stack of short form sections. Each key is a ruled box with a paper-band key strip, the source text printed underneath as reference, and then one labelled box per language. The language chips wrap, keyboard hints hide, and dialogs become bottom sheets below 30rem. Narrow screens (sign-in, connect) centre a single column at 34rem. Sign-in pairs the statement with the form in two columns from 52rem.

## Elevation & Depth

The system is flat. Depth comes from tint, since paper, paper band and entry box are three distinct grounds, and from rule weight, hair or strong. Only overlays cast a shadow: dialogs and toasts.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 1px 2px oklch(0.2 0.02 170 / 0.08), 0 12px 32px -8px oklch(0.2 0.02 170 / 0.22)`; dark: `0 1px 2px oklch(0 0 0 / 0.3), 0 16px 40px -8px oklch(0 0 0 / 0.55)`): dialogs and toasts only.

Inset box-shadows are not elevation. They are printed marks drawn inside a box: the 1px or 2px focus ring, the selected send option, and the 2px red mismatch underline.

### Named Rules
**The Only Overlays Float Rule.** A surface casts a shadow only when it sits above the page: a modal dialog or a toast. Boxes, panels, rows and buttons are ruled, not lifted.

## Shapes

Every box is a rectangle. The corner radius is 2px for buttons, inputs, the search box, segmented controls, chips, dialogs, toasts, panels and the address field. Grid cells and textareas have square corners. Circles appear only for the GitHub avatar, which is a photograph, and for the pulsing dot that shows the device sign-in is waiting.

Lines carry meaning by style:
- **Solid:** a box or a boundary.
- **Dashed:** a disabled control, an unpressed language chip, or a section separator before an action (the demo row, the declaration, the device code box).
- **Dotted:** a missing entry, drawn as a 5px-period baseline inside an empty cell.
- **Double (3px):** a closed total, under the review totals only.

The folded corner is the system's one silhouette. It is a 0.75rem triangle in the top-right corner of a cell (0.625rem in the status bar and specimen), drawn as a diagonal half-fill in airmail blue.

## Components

### Buttons
Ruled rectangles. Most actions look like printed boxes, and only sending is filled blue.
- **Shape:** 2px corner, 1px strong rule, 2.25rem minimum height, padding 0 0.875rem, weight 500.
- **Default:** entry box face and entry ink. On hover the face turns paper band and the rule turns form ink. On press it moves down 1px.
- **Send (primary):** an airmail blue fill with airmail-paper text, weight 600. It is used only on the send path: "Review & send" in the status bar and the final "Open pull request" or "Commit" button.
- **Solid:** a form-ink fill with entry-box text, weight 600, for the main step on a screen that sends nothing (sign in, load, add key, add language). On hover it turns to entry ink.
- **Quiet:** no rule and no fill, form-ink text, a paper-band fill on hover. It is used for secondary and icon actions.
- **Danger:** alert-red text on the default or quiet face. It is never a red fill.
- **Disabled:** a dashed strong rule, transparent face and soft ink. Send and solid buttons fall back to this same printed outline.
- **Icon / Mini:** a 2.25rem square, or a 1.75rem mini for row actions. Icons come from one inline SVG stroke set (24px grid, 1.75 stroke).

### Chips
- **Language chip:** 2rem tall, 2px corner. When pressed it has a solid strong rule, an entry-box face and entry ink. When unpressed it has a dashed rule, a transparent face, soft ink and a struck-through code. It holds a bold monospace language code in form ink, a SOURCE caption, and a missing count or a form-ink check when complete.
- **Edit tag (NEW / RENAMED):** a 1px airmail-blue outline with blue caption-style text and no fill.
- **Demo tag:** the same outline construction in form ink.

### Cards / Containers
There are no cards. Containers are ruled panels: a 1px strong rule, 2px corner and entry-box face, with a paper-band header strip closed by a strong rule, a 1.25rem body, and a paper footer behind a hair rule.

### Inputs / Fields
- **Style:** a caption label above a white box. The box has a 1px strong rule, 2px corner, 2.5rem minimum height, padding 0.5rem 0.625rem and 1rem text. Monospace inputs use body size.
- **Focus:** the rule turns form ink and gains a 1px inset form-ink line, so the box draws a 2px ruled edge. The global `:focus-visible` outline is 2px form ink at a 2px offset.
- **Error:** an alert-red small line below the box. Hints use soft ink at small size.
- **Search:** the same box with a form-ink search icon and a `/` key hint that hides on focus.

### Navigation
- **App bar:** a paper band 3.25rem tall, closed by a strong rule. On the left is the wordmark ("whisper" in 700 entry ink with an "editor" caption). Next comes the address field: a 1px hair-ruled entry box in monospace showing repo, branch and folder, which opens settings. Account controls sit on the right. On phones the caption and folder hide.
- **Toolbar:** a paper strip holding the search box, a segmented All / Missing control (selected segment filled with form ink), a "Next missing" jump and the language chips.
- **Status bar:** a paper band matching the app bar's height. It holds the edit count with a blue tick, a "Saved" note, and keyboard hints on wide screens, ending in the send-path button.

### Grid (signature)
A ruled table of white boxes. The sticky key column is printed on paper in form ink, and the header band shows the bold language name, the monospace code and the completion count. The cells are borderless textareas that grow with their content. Every state is a printed mark:
- **Missing:** a dotted strong-rule baseline that disappears on focus.
- **Edited:** a blue folded corner in the top right.
- **Placeholder mismatch:** a 2px red inset underline with a red small warning below.
- **Deleted:** a diagonal hatch of hair rules on paper, and the key struck through in red. Row actions stay visible so the key can be restored.
- **Focus:** a 2px form-ink inset ring.

### Review Manifest (signature)
The review step reads as a declaration.
- **Totals:** Files, Added, Changed, Removed and Placeholder issues sit in a five-cell ruled box divided by hair rules and closed with a 3px double strong rule. Each cell has a caption term over a headline number, and the issues cell turns red when non-zero.
- **Itemised files:** each file is a ruled box with a paper-band header (file name in form ink, download and undo controls). Rows give the key in form ink, then the before-value (soft ink, struck in red), then the after-value (entry ink, underlined in airmail blue).
- **Send to:** a fieldset behind a dashed rule. The options are ruled boxes, and the checked option gains a form-ink inset rule.
- **Declaration:** pinned in the footer above the send action. A dashed rule sets off a sentence that states the change count, languages, repository and branch, followed by a "Sender" caption under a 1px entry-ink signature line set in monospace.

### Overlays
- **Dialog:** a ruled entry box with a 2px corner and an overlay shadow over the scrim. It has a paper-band header with a title and a quiet close button, and a paper footer with right-aligned actions. It opens with a 200ms fade-and-rise and becomes a bottom sheet below 30rem.
- **Toast:** a ruled entry box with an overlay shadow, centred above the status bar, rising in over 220ms. Success toasts are ruled in form ink. Error toasts have a red rule, alert wash and red text.

Motion everywhere uses one ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`), 120ms for control feedback and around 200ms for overlays. Under `prefers-reduced-motion`, every animation and transition drops to 1ms.

## Do's and Don'ts

### Do:
- **Do** draw every structural boundary as a 1px rule: hair rules between items, strong rules around boxes and under header bands.
- **Do** set printed furniture (captions, keys, codes, file names, links) in form ink, and the user's content in near-black entry ink.
- **Do** show state with a printed mark on the box (dotted baseline, folded blue corner, red inset underline, hatch and strike, dashed outline) rather than a coloured fill.
- **Do** keep airmail blue for the user's edits and the send path, and fill only the send-path button with it.
- **Do** use the solid form-ink button for the main step on screens that send nothing.
- **Do** close totals with the 3px double rule and set keys with a dim prefix and a bold leaf.
- **Do** redeclare every colour token for dark mode instead of inverting.

### Don't:
- **Don't** use airmail blue for links, focus rings, selection, navigation or general emphasis. Those use form ink.
- **Don't** use red for anything except errors, placeholder mismatches and deletions.
- **Don't** round a box past 2px, and don't make rounded cards.
- **Don't** add drop shadows to anything except dialogs and toasts.
- **Don't** use pure black or pure white for ink.
- **Don't** load web fonts. The system sans and monospace stacks are the type.
- **Don't** put a decorative uppercase caption above a heading. The caption labels a box.
