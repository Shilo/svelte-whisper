# Product

<!-- impeccable:product-schema 1 -->

> Scope: the svelte-whisper **example app** only. The library's own product record lives in the
> repository root and is maintained separately. Every fact below is inferred from the written
> brief given to the design subagent (no live interview was possible) and is labelled as such.

## Platform

web

## Users

Svelte 5 developers evaluating or learning svelte-whisper (inferred from brief). They arrive
from the library README or npm page, run the demo locally or open a deployed copy, and read
`example/src` as reference code for the recommended setup.

## Product Purpose

The example app has two jobs (from brief):

1. **Reference code.** Small, idiomatic, free of clever abstractions. The source is documentation.
2. **Live demo.** Makes the library's behaviour visible: which locale files were fetched, when and
   how big; text changing instantly on a locale switch; every feature tried by hand.

Success: a developer understands the setup from the source in minutes and has *seen* lazy
loading, fallback, missing-key reporting and Intl formatting work.

## Positioning

svelte-whisper is simplicity-first and performance-first: about 1.6 kB gzip for a typical import
set, no runtime dependencies beyond Svelte, locale files lazy-loaded on demand, minimal network
traffic. Competing i18n libraries are robust but bulky. The name, "whisper", means quiet, small,
unobtrusive (from brief).

## Capabilities and Constraints

- Svelte 5 + Vite client-side SPA; a single focused page.
- Real translated content in at least en, es, fr, ja, ar (ar demonstrates right-to-left).
- Loading telemetry must come from real events (Resource Timing or wrapped loaders), never faked.
- The dev overlay is dev-only, never in production bundles, floats over the host page.
- The Vite `base` is configurable by environment variable for sub-path deployment.

## Evidence on Hand

- Library API: `../index.svelte.js`, `../index.d.ts`. Size figure (≈1.6 kB gzip) from `npm run size`.
- No testimonials, users, benchmarks or comparisons exist; none may be invented.

## Product Principles

1. The source is the documentation: no abstraction a reader has to decode.
2. Show, don't claim: every feature is demonstrated by the live library doing its job.
3. Quiet by default: the page should feel as small as the library is.

## Accessibility & Inclusion

Must work in RTL (Arabic) with mirrored layout, at phone widths, in light and dark appearance,
with keyboard only (inferred from brief).
