---
name: whisper-setup
description: Add svelte-whisper i18n to a Svelte 5 single-page app, or move hard-coded UI text into locale files. Use when asked to add i18n, localization, translations or multiple languages to a Svelte app, to set up svelte-whisper, or to internationalize a component.
---

# Set up svelte-whisper

svelte-whisper is a runtime i18n library for client-side Svelte 5 apps, built on runes. It keeps state in the module, so do not use it for server-side rendering. It has no stores: there is no `$t`, `$locale` or `tr()`.

## 1. Install

```bash
npm install svelte-whisper
```

If the package is not on the npm registry, install a tagged release from GitHub: `npm install github:Shilo/svelte-whisper#v2.0.0`. Requires `svelte@^5.9.0`. The package is a runes module that the app's Svelte plugin compiles; nothing needs configuring.

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

`init` picks the starting locale in this order: the user's stored choice, the browser's language, `initial`, then `fallback`. Awaiting it before `mount` means the first paint is already translated.

To skip the extra request for the main language, bundle it and lazy-load the rest:

```js
import en from '../locales/en.json';
addDictionary('en', en);
registerLoader(import.meta.glob(['../locales/*.json', '!../locales/en.json']));
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

<select bind:value={getLocale, setLocale}>
    {#each getLocales() as id}
        <option value={id}>{localeName(id)}</option>
    {/each}
</select>
```

- `t('key', vars)` everywhere: markup, `$derived`, `$effect`, event handlers and plain `.js`/`.ts` modules. It is reactive, so whatever called it updates when the locale changes.
- Placeholders: named `{name}` with an object, positional `{0}` or `{}` with an array.
- Plurals: an object value keyed by plural category, selected by a numeric `count`.
- `formatNumber` and `formatDate` follow the active locale and update on a switch. A percentage is `formatNumber(value, { style: 'percent' })`.
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

Then run the `whisper-translate` skill to fill the other locales, and the `whisper-audit` skill to confirm nothing is missing:

```bash
npx svelte-whisper check --usage src
```

## 7. Apps with a service worker

A PWA plugin's default precache list includes every locale chunk, so installing the app downloads all languages. Exclude the locale chunks from the precache and cache each one the first time it is used instead. Vite names a locale chunk after its file (`assets/fr-3f9a1c2b.js`); confirm the names in `dist/assets` after a build. With `vite-plugin-pwa`:

```js
VitePWA({
    workbox: {
        globIgnores: ['**/assets/{en,fr,ja}-*.js'],
        runtimeCaching: [{ urlPattern: /\/assets\/(en|fr|ja)-[\w-]+\.js$/, handler: 'CacheFirst' }],
    },
})
```

List your own locale ids in both patterns, and extend them when a language is added.
