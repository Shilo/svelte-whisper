---
name: whisper-setup
description: Add svelte-whisper i18n to a Svelte 5 single-page app, or move hard-coded UI text into locale files. Use when asked to add i18n, localization, translations or multiple languages to a Svelte app, to set up svelte-whisper, or to internationalize a component.
---

# Set up svelte-whisper

svelte-whisper is a runtime i18n library for client-side Svelte 5 apps. The app does not need runes switched on. It keeps state in the module, so do not use it for server-side rendering. Call its functions (`t('key')`, `getLocale()`), except in legacy components: one that still uses `export let`, `$:`, `$$props` or `$$restProps`, or has runes switched off (`runes: false`), only follows stores, so put `$` in front there: `$t('key')`, `$locale`, `$formatNumber(n)`. Only `t`, `locale` and the formatters have a `$` form; a helper of your own stays a plain call, so hand it `$t` or `$locale`. Match whichever kind the component already is; do not convert components as part of adding translations.

## 1. Install

```bash
npm install github:Shilo/svelte-whisper#v2.1.1
```

The package is distributed from GitHub, not the npm registry. Pin a release tag as above rather than the default branch. Requires Svelte 5 (any 5.x; Svelte 4 is not supported). The package is a runes module that the app's Svelte plugin compiles. Vite, Rollup and esbuild need nothing else. With webpack, make the `svelte-loader` rule also match `.svelte.js` files (`test: /\.svelte(\.js)?$/`). For Vitest component tests, set `resolve: { conditions: ['browser'] }`.

## 2. Create the source locale

`src/locales/en.json` (or the app's main language). Group keys by feature, in camelCase:

```json
{
  "nav": { "home": "Home", "settings": "Settings" },
  "greeting": "Hello {name}!",
  "cart": { "items": { "0": "Your cart is empty", "one": "{count} item", "other": "{count} items" } }
}
```

Add one file per additional language next to it (`fr.json`, `pt-BR.json`). The file name is the locale id; use valid language tags.

## 3. Initialise before mounting

`src/lib/i18n.js`:

```js
import { init, registerLoader } from 'svelte-whisper';

export function setupI18n() {
    // Each locale becomes its own lazily loaded chunk. Only the active one is downloaded.
    registerLoader(import.meta.glob('../locales/*.json'));
    return init({ fallback: 'en', persistKey: 'my-app-locale' });
}
```

`src/main.js`:

```js
import { mount } from 'svelte';
import { setupI18n } from './lib/i18n.js';
import App from './App.svelte';

await setupI18n();
mount(App, { target: document.getElementById('app') });
```

`init` picks the starting locale in this order: the user's stored choice, the browser's language, `initial`, then `fallback`. Awaiting it before `mount` means the first paint is already in that language. If the build rejects top-level `await` (the default target of Vite 5 and 6 does), write `setupI18n().then(() => mount(App, { target: document.getElementById('app') }))`.

To skip the extra request for the main language, bundle it and lazy-load the rest. The whole of `src/lib/i18n.js` then reads:

```js
import { init, addDictionary, registerLoader } from 'svelte-whisper';
import en from '../locales/en.json';

export function setupI18n() {
    addDictionary('en', en);
    registerLoader(import.meta.glob(['../locales/*.json', '!../locales/en.json']));
    return init({ fallback: 'en', persistKey: 'my-app-locale' });
}
```

## 4. Translate in components and modules

```svelte
<script>
    import { t, getLocale, setLocale, getLocales, localeName, formatNumber, formatDate } from 'svelte-whisper';
    let { name, count, total } = $props();
</script>

<h1>{t('greeting', { name })}</h1>
<p>{t('cart.items', { count })}</p>
<p>{formatNumber(total, { style: 'currency', currency: 'EUR' })} · {formatDate(Date.now(), { dateStyle: 'medium' })}</p>

<select value={getLocale()} onchange={async e => { const s = e.currentTarget; if (!await setLocale(s.value)) s.value = getLocale(); }}>
    {#each getLocales() as id}
        <option value={id}>{localeName(id)}</option>
    {/each}
</select>
```

- `t('key', vars)` everywhere: markup, `$derived`, `$effect`, event handlers and plain `.js`/`.ts` modules. It is reactive: markup, `$derived` and `$effect` that call it, directly or through a function, run again when the locale changes. A value computed once at the top level of a module does not.
- Placeholders: named `{name}` with an object, indexed `{0}` with an array.
- Plurals: an object value keyed by plural category, selected by a numeric `count`.
- `formatNumber` and `formatDate` follow the active locale and update on a switch. A percentage is `formatPercent(value, precision?)`. Each takes a locale as an optional last argument, to format in a language other than the active one.
- In a legacy component (`export let`, `$:`), write the same calls with `$` in front: `{$t('greeting', { name })}`, `{$formatNumber(total)}`, `{$locale}`, `bind:value={$locale}`.
- `localeName(id)` gives each language its own name, so language names need no translation keys.
- The library sets `<html lang>` and `dir` itself.

## 5. Typed keys (TypeScript or checked JS)

`src/whisper.d.ts`:

```ts
import type en from './locales/en.json';

declare module 'svelte-whisper' {
    interface Register {
        dictionary: typeof en;
    }
}
```

Keys now autocomplete, and a mistyped key is a type error. Needs `"resolveJsonModule": true`.

## 6. Moving hard-coded text into the dictionary

For each component:

1. Add a key per user-visible string to the source locale, under the component's feature group. Include text in attributes users perceive: `placeholder`, `title`, `alt`, `aria-label`.
2. Replace the literal with `t('group.key')`.
3. Turn interpolated values into placeholders: `` `Hello ${name}` `` becomes `"Hello {name}"` with `t('greeting', { name })`.
4. Keep each sentence in one key. Never join translated fragments: word order differs between languages.
5. Replace `toLocaleString()`, `toFixed()` and hand-built number, currency, percent or date strings with the formatters.
6. Use a plural object wherever the text depends on a count.

Then run the `whisper-translate` skill to fill the other locales, and the `whisper-audit` skill to check the locales against the source and the code against the keys:

```bash
npx svelte-whisper check --usage src
```

## 7. Apps with a service worker

A PWA plugin's default precache list includes every locale chunk. **Leave it that way unless the app has a reason not to.** The page still requests only the language in use; the worker fetches the others in the background when the app is installed, and every language then works offline. Nothing needs configuring.

Keep the locale chunks out of the precache only when the app ships many languages and the size of the install matters. Know what that costs offline first:

- A file is cached only when it is requested while the worker controls the page. On a first visit the language loads before that, so it is not cached until the next online visit: a user who goes offline after one visit gets no language file, and sees keys instead of text.
- A language the user has not opened, and a lazily loaded fallback, are not available offline.

So bundle the fallback language (section 3, the `addDictionary` variant): the app then always has text, in the fallback language when the user's own is not cached yet.

To do it, give the locale chunks a folder of their own, keep that folder out of the precache, and cache each file the first time it is used. In `vite.config.js`, name the chunks (Vite 8; on Vite 7 the option is `rollupOptions`):

```js
build: {
    rolldownOptions: {
        output: {
            chunkFileNames: chunk =>
                chunk.facadeModuleId?.includes('/locales/') ? 'assets/locales/[name]-[hash].js' : 'assets/[name]-[hash].js',
        },
    },
},
```

Then, with `vite-plugin-pwa`:

```js
VitePWA({
    workbox: {
        globIgnores: ['**/assets/locales/**'],
        runtimeCaching: [{ urlPattern: /\/assets\/locales\//, handler: 'CacheFirst' }],
    },
})
```

Build, then confirm that `dist/assets/locales/` holds one file per lazy language and that the generated service worker's precache list contains none of them. Then test it the way a new user meets it: a fresh browser profile, one visit, offline, reload.
