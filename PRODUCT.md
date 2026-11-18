# Product

<!-- impeccable:product-schema 1 -->

> **How this file was written.** No interview took place. It was written by a design subagent working from a written brief, with the user's explicit instruction to work fully autonomously. Facts taken directly from that brief or from the repository are stated plainly. Anything the subagent inferred is marked **(assumption)** and should be confirmed or corrected by the maintainer.

## Platform

web

## Users

- **The repository owner (developer).** On a desktop, mid-task, wants to fix a typo or add a handful of strings across languages without leaving the browser or hand-editing JSON. Knows git and JSON. Usually commits directly or opens a PR to their own repo.
- **Volunteer translators.** Contribute one language, possibly from a phone, may not know JSON, git or what a pull request is. Need to see what is missing in *their* language, type it in, and hand it back safely. Their changes always go through a PR for the owner to review.
- **First-time visitors (assumption).** People who land on the hosted editor from the README to see what it is before connecting a repo. They should be able to try the grid without credentials.

## Product Purpose

The svelte-whisper localization editor is a 100% client-side companion to the svelte-whisper i18n library. A user signs in with GitHub (OAuth device flow through a small CORS proxy, or a personal access token), points the editor at a repository, branch and locales folder, edits the locale JSON files in a grid with one column per language, and submits the result as a pull request or a direct commit.

Success means: a translator can find and fill missing strings in minutes without touching JSON, and the owner receives a clean, minimal, reviewable diff that round-trips the original file structure.

## Positioning

svelte-whisper is a ~1 KB, pure-runtime i18n library for Svelte 5 client-side SPAs: simplicity-first, performance-first, lazy-loaded, low network traffic. The name means quiet, small, unobtrusive. Competing i18n stacks (and their editors, such as inlang's Fink, which inspired this one) are robust but heavy. The editor carries the same promise: no backend, no database, no account beyond GitHub, a small bundle, and a single job done well.

## Operating Context

- Hosted on GitHub Pages at https://shilo.github.io/svelte-whisper/ (SvelteKit + adapter-static, base path `/svelte-whisper`), deployed by `.github/workflows/deploy-editor.yml`.
- Talks directly to `api.github.com` from the browser. OAuth device flow needs a Cloudflare Worker (or similar) CORS proxy for GitHub's two OAuth endpoints; without it, only PAT sign-in is offered.
- Locale files are one JSON file per language in a folder (default `src/locales`, the library's zero-config default is `/locales/<lang>.json` under `public/`). Values may be flat keys (`"app.title"`) or nested objects resolved by dotted paths; strings may contain interpolation placeholders `{name}`, `{0}` and positional `{}`.
- Sessions are short and task-shaped: open, find the gaps, fill them, submit.

## Capabilities and Constraints

- Static site only: no server routes, no server-side storage, no secrets in the bundle (the OAuth client ID is public).
- Submission modes: pull request on a new `whisper/translations-<timestamp>` branch (default, for everyone) or direct commit to the configured branch (for owners).
- Must stay lean: every dependency and kilobyte is questioned; anything not needed for first paint is lazy-loaded.
- Must work from phone width (≈360–390 px) to wide desktop, with keyboard and screen readers.
- A no-sign-in demo mode with sample data is part of the product (assumption: it is acceptable to ship sample data in the bundle as long as it is small and lazy-loaded).
- Token storage: the GitHub token lives in `sessionStorage` (per tab, cleared when the tab closes). This is a deliberate trade-off between convenience and exposure; see the editor README.
- Undecided: whether the editor should support non-JSON formats, plural rules, or multiple locale folders. Out of scope until the library supports them.

## Brand Commitments

- Name: **svelte-whisper**; the editor is "the svelte-whisper editor" or "Whisper editor". (assumption: no logo exists beyond the favicon; none should be invented as a mark.)
- Voice: plain, quiet, precise. Short sentences, no hype, no exclamation marks, no emoji in the UI. (assumption, derived from the library's "quiet, small, unobtrusive" identity)
- The editor should echo the library's character: small, fast, unobtrusive; brand lives in precise details rather than decoration.

## Evidence on Hand

- The library itself (`index.js`, ~1 KB) and its README.
- Example locale files in `example/public/locales/{en,es,fr}.json` showing nested keys and `{user}` / `{}` placeholders.
- No testimonials, user counts, benchmarks for the editor, or customer logos exist. Do not invent them.

## Product Principles

1. **Small is the feature.** If a capability makes the editor noticeably heavier or more confusing, it does not ship.
2. **Show the gap.** The first thing either user needs is what is missing or changed; the grid makes gaps and edits obvious at a glance.
3. **Never surprise a repository.** Edits round-trip the file's structure and key order; nothing is written until the user has seen the diff and chosen PR or commit.
4. **No JSON, no git required.** A translator can complete the whole job knowing only their language.
5. **Trust through plainness.** Clear state, honest copy about where the token lives and what will be written.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast in both light and dark themes; theme follows the system preference.
- Fully keyboard-operable grid, visible focus, labelled controls, respects `prefers-reduced-motion`.
- Translators may work in RTL scripts and CJK; cells must render any script and set `dir="auto"` / `lang` per column (assumption).
