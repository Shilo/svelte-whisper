---
version: 1
slug: "src-app-svelte"
primary_target: "src/App.svelte"
related_targets: []
---

# Surface brief: example demo page

Scope: `example/src/App.svelte` and its components; visitor mode Experience (the live library is the work). Audience: Svelte 5 developers evaluating svelte-whisper. Job: see lazy loading, instant switching, plurals, Intl formatting, fallback and missing-key reporting work, then read the source. Constraints: single page, source stays small and idiomatic, telemetry real, RTL mirrors.

## Direction contract

THESIS: The page is a multilingual transit sign system: every feature is a numbered sign that changes language the instant you pick a gate. It refuses the library-landing default (gradient hero, code blocks, feature-card grid).

OWN-WORLD: Enamel sign panels on concrete ground; an ink overhead band; one signal yellow reserved for "you are here" (the active locale). Atkinson Hyperlegible Next for all signage, its Mono sibling for codes, bytes and API calls. Square pictogram plates (authored SVG, one stroke); direction arrows that mirror in RTL. Unloaded locales are dashed outlines, loaded ones solid.

STORY: The visitor sees the page speak their language, picks another gate, watches one file arrive on the arrivals board with its real size, then tries each sign by hand and reads the one-line call under it.

FIRST VIEWPORT: Ink overhead band across the top with the wordmark, the five language gates and the size plate. Below, the active-language welcome line at sign scale, a quiet subline, and on the trailing side the arrivals board listing fetched locale files. Primary action: the gates.

FORM: Multilingual wayfinding signage, candidate 5 of 7 on my ordered list. seed:a88467c46972cd38. Raises kept from declined challengers: dashed/solid load state (sewing pattern), single "now" marker (step row), an index that is true (every board row is a real request) and honest absence (ekiben).

FINISH: unreviewed and undocumented is unfinished; review against this contract and record DESIGN.md before reporting done.
