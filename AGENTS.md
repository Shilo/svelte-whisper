# Working on svelte-whisper

A tiny runtime i18n library for Svelte 5 single-page apps. Read `README.md` for what it does and `llms.txt` for how apps use it.

## What the project optimises for

In this order: simplicity, runtime speed, bundle size, and as little network traffic as possible. A change that adds API surface, bytes or a dependency needs a concrete user problem behind it. Prefer a platform feature (`Intl`, dynamic `import()`) over code of our own, and prefer a recipe in the README over a new export.

- The core is one Svelte runes module, `index.svelte.js`, with a hand-written `index.d.ts`. It is shipped as source and compiled by the consuming app's Svelte plugin; there is no build step of our own, so keep it that way.
- Runes only, everywhere in this repository: no `svelte/store` import, no legacy component syntax, and no SvelteKit. Two exceptions: the fixtures in `test/fixtures/`, and the one component in `example/` that demonstrates legacy syntax. The library still serves apps that have legacy components (`export let`, `$:`): `t`, `locale`, `formatNumber`, `formatPercent` and `formatDate` implement the store contract by hand, because stores are all Svelte follows there. The rule for those apps is one sentence: in a legacy component, put `$` in front. A new export that depends on the active locale gets a `$` form too; one that does not (`localeName`, `getLocales`) gets none. `example/` and `editor/` are plain Vite + Svelte apps with `compilerOptions.runes` switched on.
- The module imports nothing but its own dev overlay (in dev mode) and has one `$state` signal. Do not add dependencies, and keep dictionaries as plain non-reactive data.
- Read the signal where the result depends on it (`version < 0 ? '' : current`), never as a bare statement such as `void version;`: Vite 5 and 6.0 minify the module before the Svelte plugin sees it and drop such a read, and reactivity with it. `test/runes.test.js` checks this.
- An export that is also a store is built with `/* @__PURE__ */ storeOf(…)`, the one helper behind `t`, `locale` and the formatters, so an app that does not import it does not ship it. `npm run size` shows whether the typical bundle stayed the same.
- Every Svelte 5 release is supported (`peerDependencies.svelte` is `^5.0.0`). CI runs the tests at `svelte@5.0.0` and at the newest release, so do not use a Svelte API newer than 5.0 in the library, and check anything Svelte compiles differently across 5.x in `test/modes.test.js`.
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
| `test/` | `node --test` suites; `modes.test.js` mounts the components in `fixtures/modes/` in happy-dom; `type-tests/` holds compile-time checks of `index.d.ts` |
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

- Every behaviour change comes with a test. The library keeps module-level state, so tests load a fresh compiled copy with `load()` from `test/helpers.js`, check reactivity in real effects with `observe()`, and compile components against the URL of a fresh copy from `fresh()`.
- Keep `README.md`, `llms.txt`, `index.d.ts`, `CHANGELOG.md` and the skills in step with the code in the same change.
- Published claims about size and speed must come from `npm run size` and `npm run bench`.
- `setLocale` must stay synchronous when the dictionary is already in memory.
- Commit messages follow Conventional Commits.
