# Changelog

## 2.0.0

A rewrite of the core with the same everyday API. Most apps upgrade without code changes; read "Upgrading from 1.x" for the behaviour that changed.

### Added

- **Plurals.** A dictionary value that is an object keyed by plural category (`one`, `other`, …, or an exact number such as `"0"`) is selected by a numeric `count`, using the browser's `Intl.PluralRules`.
- **Formatting.** `formatNumber(value, options?, locale?)` accepts every `Intl.NumberFormat` option (currency, compact, units). New `formatDate(value, options?, locale?)` and `localeName(id, displayLocale?)`.
- **Reactive plain functions.** `tr()`, `getLocale()` and the formatters re-run inside Svelte templates, `$derived` and `$effect` when the locale or a dictionary changes. Previously `{formatNumber(n)}` kept showing the old locale's format after a switch.
- **Glob registration.** `registerLoader(import.meta.glob('./locales/*.json'))` registers every file, using the file name as the locale id.
- **Lazy fallback.** A fallback locale that is registered with a loader is downloaded the first time a key is missing, then the text updates. Before, it was never loaded, so users saw raw keys.
- `loadLocale(id)` to preload a locale, `getLocale()`, and `detectLocale()`.
- `<html lang>` and `dir` follow the active locale.
- Typed keys at no runtime cost, by augmenting the `Register` interface.
- `svelte-whisper` command line tool: `check`, `diff`, `apply`, `sync`, `keys`.
- Agent skills in `skills/`: `whisper-setup`, `whisper-translate`, `whisper-audit`.

### Changed

- Dictionaries are flattened when added, so a nested key costs one lookup. Nested keys resolve about three times faster, interpolation about two and a half times, and `tr()` no longer subscribes and unsubscribes on every call.
- The library no longer imports `svelte/store`. `locale` and `t` implement the store contract directly, so `$locale` and `$t` work as before.
- `setLocale()` and `locale.set()` resolve to a boolean. When several calls overlap, the last one wins regardless of which download finishes first.
- Locale detection also matches across regions (`pt` → `pt-BR`, `en-GB` → `en-US`) and no longer matches on a shared prefix of a different language (`fil` no longer selects `fi`).
- The dev overlay is not mounted under browser automation (`navigator.webdriver`).

### Fixed

- A locale whose dictionary fails to load is no longer activated or stored.
- A dictionary with a top-level `"default"` string is no longer mistaken for a module wrapper.
- Keys named like `Object.prototype` members (`constructor`, `toString`) no longer resolve to functions.
- `addDictionary` merges nested objects deeply instead of replacing the whole branch.
- Missing keys are no longer reported for the empty locale before `init()` runs.
- Calling `init()` again without `fallback` returns to the default (`en`) instead of keeping the previous value.
- Locale ids and keys named like `Object.prototype` members no longer match inherited properties.
- A plural taken from the fallback locale is chosen with the fallback language's rules.
- Detection prefers the most specific match (`zh-Hant-TW` selects `zh-Hant` before `zh`).

### Upgrading from 1.x

- **Requires `svelte@^5.7.0`.**
- **`formatPercent` is locale-aware.** Output is unchanged in most locales, but French, German and others now get their own spacing and separators (`20 %` in French). Non-integer values above 999 gain grouping separators.
- **A failed load keeps the current locale.** In 1.x, `setLocale('ja')` switched to `ja` even when its file could not be downloaded, and showed fallback text. Now the locale stays as it was and the promise resolves `false`. `init()` moves on to the next candidate.
- **Unknown locales are not fetched once loaders exist.** The zero-config request for `/locales/{locale}.json` now applies only when no loader has been registered. If you mix loaders with fetched files, register a loader for those files as well.
- **The zero-config request honours Vite's `base`.** It was always `/locales/…`; it is now `{base}locales/…`.
- **`null` interpolation values** leave the placeholder in place, as `undefined` already did, instead of printing `null`.
- **`{count}` plural selection** applies when a value is an object with an `other` form and `vars.count` is a number. A dictionary that stored such an object under a key and called it with a numeric `count` will now receive one member.
- **`init({ detect: { ja: 'jp' } })`** selects the mapped locale only if it can be loaded, like any other candidate.
- **Loader results** are unwrapped only when they are an ES module or an object whose single key is `default`. A dictionary that has a `default` group next to other keys is now used as written.
- The `svelte-whisper/dev-overlay` export is gone; the overlay is internal. Its bridge changed from `mount({ subscribe, getKeys, clear })` to `mount({ keys, listen, clear })`.
