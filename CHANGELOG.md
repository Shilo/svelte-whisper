# Changelog

## 2.3.0

### Changed

- **`localeName` cases a name as a label.** The platform usually names languages in the form for running text, which Spanish, French, Russian and many others write in lowercase, so a language menu built as the README shows listed "español" and "français". A name that starts in lowercase now gets a capital: `localeName('es')` is `Español` and `localeName('de', 'fr')` is `Allemand`. The letter is raised by the rules of the language the name is written in (Turkish and Azerbaijani "i" becomes "İ"). Names without case, Georgian, and names whose first word carries its own capital, such as `isiZulu`, are left as they are, and so is the code the platform returns for a language it cannot name. This is one rule for every language, similar in intent to the sentence casing of Android's language picker; it does not follow the per-language list rules in Unicode's data, which leave a few languages such as Polish and Catalan in lowercase.

  If you put `localeName()` inside a sentence, pass the new third argument to keep the old result.

### Added

- **`localeName(id, displayLocale, true)`** returns the platform's name unchanged, for a name that goes into a sentence: `localeName('es', 'es', true)` is `español`.

### Size

- 1,779 B gzip for a typical app, unchanged. With every export: 2,106 B (was 2,011); the budget for that bundle goes from 2,050 to 2,150.

## 2.2.0

### Changed

- **A bundled fallback is active while the chosen language downloads.** When the fallback language is already in memory (`addDictionary`) and `init` has to download the user's language, the fallback is the active locale until the file arrives: `getLocale()` returns it instead of `''`, and `<html lang>` is set. An app that mounts before `init` resolves, for example after a short wait on a slow network, now has a real locale to pass to `Intl` and to compare against, and switches when the file arrives. Nothing changes for an app that awaits `init`, when the fallback is lazy, or when the chosen language is already in memory. The README has the recipe: "Do not wait for a slow language file".
- **Size.** 1,779 B gzip for a typical app (was 1,770), 2,011 B with every export (was 1,999).

## 2.1.1

Documentation only; the library code is the same as 2.1.0.

### Fixed

- **Service worker advice.** The README and the `whisper-setup` skill told every PWA to keep locale chunks out of the precache and cache them on first use. A first visit loads its language before the worker controls the page, so nothing was cached, and a user who then went offline saw keys instead of text. The default precache is now the recommendation; leaving the locale chunks out is described as an option for apps with many languages, with what it costs offline and the advice to bundle the fallback language.

## 2.1.0

Runes, legacy and mixed apps all work without a change to the app. Legacy components get one rule: put `$` in front.

### Added

- **`$formatNumber`, `$formatPercent`, `$formatDate`.** The formatters are stores of themselves, like `t`, so a legacy component writes `{$formatNumber(n)}` where it wrote `formatNumber(n, undefined, $locale)`. The third `locale` argument stays, for formatting in an explicit locale. An app that imports no formatter ships none of them.

### Fixed

- **Production builds on Vite 5 and Vite 6.0.** These pass the module through esbuild before the Svelte plugin sees it, and that dropped the read of the locale signal: plain `t()` and `getLocale()` in runes components stopped updating after a switch, in production only.

### Changed

- **Any Svelte 5.** `peerDependencies.svelte` is `^5.0.0` (was `^5.9.0`), and CI runs the tests at 5.0.0 and at the newest release. Svelte 4 is not supported. The README's `bind:value={getLocale, setLocale}` recipe still needs 5.9, for function bindings.
- **Size.** Unchanged: 1,770 B gzip for a typical app, 1,999 B with every export.

## 2.0.0

A rewrite on Svelte 5 runes with a smaller API. Runes code calls plain functions; legacy components (`export let`, `$:`) keep `$t` and `$locale`, because stores are the only thing Svelte follows there.

### Replaced

| 1.x | 2.0 |
|---|---|
| `tr('key')` | `t('key')`: one reactive function for markup, `$derived`, `$effect` and plain modules |
| `$t('key')` | Unchanged in legacy components (`t` is also a store). Elsewhere, `t('key')`. |
| `$locale` | Unchanged in legacy components. Elsewhere, `getLocale()`. |
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
- **Everything is reactive in runes code.** `t()`, `getLocale()` and the formatters (unless given a locale of their own) re-run inside markup, `$derived` and `$effect` when the locale or a dictionary changes. In 1.x, `{formatNumber(n)}` kept the old locale's format after a switch. In a legacy component, pass the locale: `formatNumber(n, options, $locale)`.
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
- **Detection** matches by language and script as the browser understands them: `zh-TW` selects `zh-Hant` and never `zh-Hans`, `pt` selects `pt-BR`, `en-GB` prefers a plain `en` and otherwise takes another region of English, and a different language that shares a prefix no longer matches (`fil` no longer selects `fi`).
- **`null` interpolation values** leave the placeholder in place, as `undefined` does.
- **Loader results** are unwrapped only when they are an ES module (`() => import('./fr.json')`). A loader you write yourself returns the dictionary itself.
- **`addDictionary`** merges nested groups deeply and `null` values read as "not translated". For a locale that also has a loader, added translations sit on top of the loaded file and the loader still runs; in 1.x an added dictionary stopped the loader from ever running.
- Keys and locale ids named like `Object.prototype` members (`constructor`, `toString`) are ordinary strings.
- Missing keys are not reported before a locale is active, and the dev overlay is not mounted under browser automation.

### Performance

Dictionaries are flattened when added, so a nested key costs one lookup: about 10 ns against 29 ns in 1.x for a 600-message dictionary. Interpolation is about two and a half times faster. Calling the translate function outside markup no longer subscribes and unsubscribes on every call.
