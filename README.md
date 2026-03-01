# Svelte Whisper 🤫

The minimalist, frictionless, and incredibly fast i18n localization library designed specifically for **Svelte 5** Single Page Applications.

Svelte Whisper prioritizes a tiny footprint, zero configuration, and blazing-fast runtime above all else. With less than 60 lines of vanilla JavaScript, it provides all the essential internationalization features without complex build steps or compile-time dependencies.

## Features

- **Extremely Lightweight**: ~1KB minified, pure JS. No bloated dependencies.
- **Svelte 5 Ready**: Built on Svelte `store` primitives (`writable`, `derived`) for flawless reactivity.
- **Lazy Loading**: Avoids async waterfall delays. Load the default language synchronously, and lazy load others only when requested.
- **Interpolations**: Built-in support for positional (`{0}`) and named (`{user}`) variables.
- **Deep Keys**: Access deeply nested JSON objects flawlessly (`app.ui.header.title`).
- **Graceful Fallbacks**: Automatically falls back to your specified default language dictionary if a key is missing in the active locale.

## Installation

```bash
npm install svelte-whisper
```
*(Note: Requires Svelte ^5.0.0 peer dependency)*

## Getting Started

In your `main.js` or root layout setup, initialize Svelte Whisper.

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
<!-- en.json: { "items": "Found {0} out of {1} items" } -->
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
