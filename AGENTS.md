# Working on svelte-whisper

A tiny runtime i18n library for Svelte 5 single-page apps. Read `README.md` for what it does and `llms.txt` for how apps use it.

## What the project optimises for

In this order: simplicity, runtime speed, bundle size, and as little network traffic as possible. A change that adds API surface, bytes or a dependency needs a concrete user problem behind it. Prefer a platform feature (`Intl`, dynamic `import()`) over code of our own, and prefer a recipe in the README over a new export.

- The core is one Svelte runes module, `index.svelte.js`, with a hand-written `index.d.ts`. It is shipped as source and compiled by the consuming app's Svelte plugin; there is no build step of our own, so keep it that way.
- Runes only, everywhere in this repository: no `svelte/store`, no legacy component syntax, and no SvelteKit. `example/` and `editor/` are plain Vite + Svelte apps with `compilerOptions.runes` switched on.
- The module imports nothing but its own dev overlay (in dev mode) and has one `$state` signal. Do not add dependencies, and keep dictionaries as plain non-reactive data.
- This is a 2.0 with no compatibility layer: do not add aliases, deprecated exports or shims for 1.x.
- Anything not needed at startup must stay lazy: locale files load on demand, and `dev-overlay.js` is requested only by the Vite dev server.
- `npm run size` enforces a gzip budget. If a change needs more room, raise the budget deliberately in `scripts/size.js` and justify it in the commit message.

## Layout

| Path | What it is |
|---|---|
| `index.svelte.js`, `index.d.ts` | The library and its types |
| `dev-overlay.js` | Dev-only missing-key overlay, vanilla JS in a Shadow DOM |
| `bin/svelte-whisper.js` | Locale tools (`check`, `diff`, `apply`, `sync`, `keys`), Node only, zero dependencies |
| `skills/` | Agent skills shipped to consumers; they drive the CLI |
| `test/` | `node --test` suites; `type-tests/` holds compile-time checks of `index.d.ts` |
| `scripts/` | `compile.js` (compiles the module for tests and measurements), `size.js`, `bench.js` |
| `example/` | Demo app and reference setup (its own `package.json`) |
| `editor/` | Companion locale editor, deployed to GitHub Pages (its own `package.json`) |

## Commands

```bash
npm run check        # tests, type checks and size budget: run before every commit
npm test             # runtime tests only
npm run bench        # micro-benchmarks
```

`example/` and `editor/` are separate projects: run `npm install` and `npm run dev` inside each.

## Conventions

- Every behaviour change comes with a test. The library keeps module-level state, so tests load a fresh compiled copy with `load()` from `test/helpers.js`, and check reactivity in real effects with `observe()`.
- Keep `README.md`, `llms.txt`, `index.d.ts`, `CHANGELOG.md` and the skills in step with the code in the same change.
- Published claims about size and speed must come from `npm run size` and `npm run bench`.
- `setLocale` must stay synchronous when the dictionary is already in memory.
- Commit messages follow Conventional Commits.
