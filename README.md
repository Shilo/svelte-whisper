# Svelte Whisper 🤫

The minimalist, frictionless, and incredibly fast i18n localization library designed specifically for **Svelte 5** Single Page Applications.

Svelte Whisper prioritizes a tiny footprint, zero configuration, and blazing-fast runtime above all else. With less than 60 lines of vanilla JavaScript, it provides all the essential internationalization features without complex build steps or compile-time dependencies.

## Features

- **Extremely Lightweight**: ~1KB minified, pure JS. No bloated dependencies.
- **Svelte 5 Ready**: Built on Svelte `store` primitives (`writable`, `derived`) for flawless reactivity.
- **Zero-Config File Auto-Loading**: If no dictionaries or load handlers are provided, Svelte Whisper natively tries a network fetch to `/locales/{lang}.json` as a magical fallback!
- **Lazy Loading**: Avoids async waterfall delays. Load the default language synchronously, and lazy load others only when requested.
- **Interpolations**: Built-in support for auto-positional (`{}`), indexed (`{0}`), and named (`{user}`) variables.
- **Deep Keys**: Access deeply nested JSON objects flawlessly (`app.ui.header.title`).
- **Graceful Fallbacks**: Automatically falls back to your specified default language dictionary if a key is missing in the active locale.

## Installation

Because `svelte-whisper` is a single `< 70` lines vanilla JavaScript runtime file, you have multiple ways to install it.

### Option 1: NPM (Recommended)
```bash
npm install svelte-whisper
```

### Option 2: Direct from GitHub
You can bypass the npm registry entirely and install the package directly from the public Git repository:
```bash
npm install github:YOUR_GITHUB_USERNAME/svelte-whisper
```
*(Make sure to replace `YOUR_GITHUB_USERNAME` with your actual username once uploaded!)*

### Option 3: Manual Drop-In (Zero config)
Because there are no build steps, you can literally just copy the `index.js` file into your Svelte project's `src/lib/` folder:
1. Copy `index.js` and rename it to `svelte-whisper.js`.
2. Import it anywhere in your app: `import { t, locale } from '$lib/svelte-whisper.js';`

*(Note: Regardless of installation method, `svelte-whisper` requires a `svelte` `^5.0.0` peer dependency)*

## Minimal Quick Start (Zero Config)

Want to get started in 10 seconds without any async code, configuration, or initialization logic? 

Because Svelte Whisper natively falls back to fetching missing dictionary definitions from your `public/locales/` folder, you literally just need to set the `locale` store.

```svelte
<!-- App.svelte -->
<script>
  import { t, locale } from 'svelte-whisper';
  
  // Triggers an automatic silent `fetch('/locales/en.json')` !
  locale.set('en');
</script>

<h1>{$t('hello')}</h1>
<p>{$t('my_name', ['Svelte'])}</p>

<!-- Translates instantly if you have /locales/es.json -->
<button onclick={() => locale.set('es')}>Spanish</button>
<button onclick={() => locale.set('en')}>English</button>
```

---

## Optimal Setup (Hybrid Approach)

The best way to use `svelte-whisper` is to bundle your primary language directly into your JavaScript so it loads instantly without any network delay, and let the auto-fetch fallback handle the rest.

```svelte
<!-- App.svelte -->
<script>
  import { addDictionary, t, locale } from 'svelte-whisper';
  import enDict from './locales/en.json'; // Bundled directly into JS

  // 1. Add English synchronously so it instantly renders
  addDictionary('en', enDict); 

  // 2. Set the active locale
  locale.set('en'); // No network request happens because 'en' is in memory!
</script>

<h1>{$t('hello')}</h1>

<!-- 3. If a user clicks this, because 'es' isn't in memory yet, 
     svelte-whisper WILL automatically fetch('/locales/es.json') -->
<button onclick={() => locale.set('es')}>Switch to Spanish</button>
```

---

## Direct Injections Setup

For larger apps, you'll want to initialize `svelte-whisper` in your `main.js` and lazy-load additional languages:


```javascript
import { mount } from 'svelte';
import { init, addDictionary, registerLoader } from 'svelte-whisper';
import App from './App.svelte';

// 1. Sync load your primary language bundle
import enDict from './locales/en.json';
addDictionary('en', enDict);

// 2. Register async loaders for alternative languages
registerLoader('es', () => import('./locales/es.json'));
registerLoader('fr', () => import('./locales/fr.json'));

// 3. Initialize Whisper targeting an initial and fallback language
init({
  fallback: 'en',
  initial: 'en'
});

mount(App, { target: document.getElementById('app') });
```

## Usage in Components

Import the generated `$t` derived store and the `$locale` store directly into any component.

```svelte
<script>
  import { t, locale } from 'svelte-whisper';
</script>

<!-- Simple Key -->
<h1>{$t('app.title')}</h1>

<!-- Deep Nested Key -->
<p>{$t('deeply.nested.property')}</p>

<!-- Named Interpolation -->
<!-- en.json: { "greeting": "Hello {user}!" } -->
<p>{$t('greeting', { user: 'Alice' })}</p>

<!-- Positional Interpolation -->
<!-- en.json: { "items": "Found {} out of {} items" } -->
<p>{$t('items', [5, 10])}</p>

<!-- Reactive Locale Switching -->
<button onclick={() => locale.set('es')}>
  Switch to Spanish
</button>
<button onclick={() => locale.set('en')}>
  Switch to English
</button>

<p>Current Locale: {$locale}</p>
```

## API Reference

### `init(options)`
Bootstraps the Svelte Whisper configuration parameters.
- `options.fallback` (String): The dictionary fallback locale key (default: `'en'`).
- `options.initial` (String): Set the default booting language. 

### `addDictionary(locale, dict)`
Synchronously merge a JSON object dictionary into a locale space. Useful for injecting the primary application language on boot.

### `registerLoader(locale, asyncLoaderFn)`
Defines an async function responsible for returning a dictionary object or a module where `module.default` is a dictionary. Calling `locale.set(key)` evaluates this loader once.

### `locale`
A specialized Svelte store reflecting the active locale string (e.g., `'en'`).
- **`locale.subscribe`**: Reactive `$locale` syntax.
- **`locale.set(newLocale)`**: Instructs Svelte Whisper to change language. Will fire off lazy loaders registered via `registerLoader` if the dictionary is missing.

### `t`
A Svelte derived store representing a pure function `(key: string, vars?: any[] | object) => string`.
It automatically resolves paths, substitutes variables, queries fallback dictionaries, and re-renders Svelte components reactively anytime dictionaries or the active `locale` shifts.

## Philosophy
Svelte Whisper does **not** rely on compile-time integrations, routing manipulation, tree shaking dependencies, or heavy config maps. Its goal is strictly mapping dynamic dictionary values into memory securely & reactively without any configuration overhead for CSR SPAs.
