# Changelog

## 2.0.0

A rewrite on Svelte 5 runes with a smaller API. Runes code calls plain functions; components that do not use runes keep `$t` and `$locale`, because stores are the only thing Svelte follows there.

### Replaced

| 1.x | 2.0 |
|---|---|
| `tr('key')` | `t('key')`: one reactive function for markup, `$derived`, `$effect` and plain modules |
| `$t('key')` | Unchanged in components without runes (`t` is also a store). In runes components, `t('key')`. |
| `$locale` | Unchanged in components without runes. In runes code, `getLocale()`. |
| `locale.set('fr')` | Still there; `setLocale('fr')` is the usual call. In a runes form control, `bind:value={getLocale, setLocale}`. |
| `formatPercent(0.2, 1)` | Unchanged call, now locale-aware (`20 %` in French) and with an optional third argument for the locale |
| `getFallbackLocale()` | Removed. You passed the fallback to `init`. |
| Automatic `{}` placeholders | `{0}`, `{1}`: indexed placeholders can be reordered by a translation |
| `t()` returning arrays and objects | `t()` always returns a string; address list items by index (`rules.0`) |
| `init({ detect: { ja: 'jp' } })` mapping | Removed. Detection needs no configuration; name locale files with real language tags. |
| `index.js` importing `svelte/store` | `index.svelte.js`, a runes module with no dependencies, compiled by your app's Svelte plugin. The two stores implement the store contract directly. |
| `svelte-whisper/dev-overlay` export | Removed. The overlay is internal. |

Requires `svelte@^5.9.0`.

### Added

- **Plurals.** A dictionary value that is an object with an `other` form (`one`, `few`, `many`, `other`, or an exact number such as `"0"`) is selected by a numeric `count`, using the browser's `Intl.PluralRules`.
- **Formatting.** `formatNumber(value, options?, locale?)` accepts every `Intl.NumberFormat` option (currency, percent, compact, units). New `formatDate(value, options?, locale?)` and `localeName(id, displayLocale?)`.
- **Everything is reactive in runes code.** `t()`, `getLocale()` and the formatters re-run inside markup, `$derived` and `$effect` when the locale or a dictionary changes. In 1.x, `{formatNumber(n)}` kept the old locale's format after a switch. In a component without runes, pass the locale: `formatNumber(n, options, $locale)`.
- **Glob registration.** `registerLoader(import.meta.glob('./locales/*.json'))` registers every file, using the file name as the locale id.
- **Lazy fallback.** A fallback locale that is registered with a loader is downloaded the first time a key is missing, then the text updates. In 1.x it was never loaded, so users saw raw keys.
- `loadLocale(id)` to preload a locale, `getLocale()`, and `detectLocale()`.
- `<html lang>` and `dir` follow the active locale.
- Typed keys at no runtime cost, by augmenting the `Register` interface.
- `svelte-whisper` command line tool: `check`, `diff`, `apply`, `sync`, `keys`.
- Agent skills in `skills/`: `whisper-setup`, `whisper-translate`, `whisper-audit`.

### Changed behaviour

- **A failed load keeps the current locale.** `setLocale('ja')` no longer switches when the file cannot be downloaded. The promise resolves `false`, and `init()` moves on to its next candidate.
- **`setLocale()` resolves a boolean**, and when several calls overlap the last one wins, whichever download finishes first.
- **Number and percent output is locale-aware throughout**, including spacing and separators (`20 %` in French).
- **Unknown locales are not fetched once loaders exist.** The zero-config request for `{base}locales/{locale}.json` applies only while no loader is registered, and it honours Vite's `base`.
- **Detection** matches by language and script as the browser understands them: `zh-TW` selects `zh-Hant` and never `zh-Hans`, `pt` selects `pt-BR`, `en-GB` prefers a plain `en` and otherwise falls back to `en-US`, and a different language that shares a prefix no longer matches (`fil` no longer selects `fi`).
- **`null` interpolation values** leave the placeholder in place, as `undefined` does.
- **Loader results** are unwrapped only when they are an ES module or an object whose single key is `default`.
- **`addDictionary`** merges nested groups deeply and `null` values read as "not translated". For a locale that also has a loader, added translations sit on top of the loaded file and the loader still runs; in 1.x an added dictionary stopped the loader from ever running.
- Keys and locale ids named like `Object.prototype` members (`constructor`, `toString`) are ordinary strings.
- Missing keys are not reported before a locale is active, and the dev overlay is not mounted under browser automation.

### Performance

Dictionaries are flattened when added, so a nested key costs one lookup: about 10 ns against 29 ns in 1.x for a 600-message dictionary. Interpolation is about two and a half times faster. Calling the translate function outside markup no longer subscribes and unsubscribes on every call.
