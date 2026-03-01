# Svelte Whisper 🤫

The minimalist, frictionless, and incredibly fast i18n localization library designed specifically for **Svelte 5** Single Page Applications.

Svelte Whisper prioritizes a tiny footprint, zero configuration, and blazing-fast runtime above all else. With less than 60 lines of vanilla JavaScript, it provides all the essential internationalization features without complex build steps or compile-time dependencies.

## Features

- **Extremely Lightweight**: ~1KB minified, pure JS. No bloated dependencies.
- **Blazing Fast**: Engineered with O(1) fast-path evaluations, achieving over 400,000,000 ops/sec for dictionary lookups.
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
npm install github:Shilo/svelte-whisper
```


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

The `svelte-whisper` package provides the following exports to manage your application's internationalization state.

### `init(options)`
Bootstraps the Svelte Whisper configuration parameters. This is typically called once in your main application entry point.
- `options.fallback` (String): The dictionary fallback locale key (default: `'en'`). If a translation key is missing in the currently active locale, `svelte-whisper` will attempt to resolve it using this fallback locale.
- `options.initial` (String): Sets the default booting language. If provided, `svelte-whisper` will immediately set the `locale` store to this value.

### `addDictionary(locale, dict)`
Synchronously merges a JSON object dictionary into a locale space in memory.
- **Why use it?** Useful for injecting the primary application language on boot (e.g., your fallback language). By bundling the fallback language directly and adding it via `addDictionary`, you ensure the app renders instantly without an initial network waterfall.
- `locale` (String): The language code (e.g., `'en'`).
- `dict` (Object): The JSON dictionary representing translations.

### `registerLoader(locale, asyncLoaderFn)`
Defines an asynchronous function responsible for fetching or dynamically importing a dictionary.
- **Why use it?** Use this to define code-splitting boundaries for alternative languages, ensuring they are only loaded when requested by the user.
- `locale` (String): The language code (e.g., `'es'`).
- `asyncLoaderFn` (Function): A function returning a Promise that resolves to a dictionary object or a module where `module.default` is a dictionary (e.g., `() => import('./locales/es.json')`). Calling `locale.set(key)` evaluates this loader once.

### `locale`
A specialized Svelte 5 `writable` store reflecting the currently active locale string (e.g., `'en'`).
- **`$locale`**: You can subscribe to changes using standard Svelte reactivity.
- **`locale.set(newLocale)`**: Instructs Svelte Whisper to change the requested language. If the dictionary for `newLocale` is not already in memory, this action will fire off lazy loaders registered via `registerLoader`, or fallback to an automatic `fetch('/locales/{newLocale}.json')`.

### `t`
A Svelte 5 `derived` store representing a pure translation function. 
- **Signature:** `(key: string, vars?: any[] | object) => string`
- **Behavior:** It automatically resolves paths, substitutes positional or named variables, queries fallback dictionaries if keys are missing, and re-renders any Svelte components reactively anytime dictionaries update or the active `locale` shifts.

## Philosophy
Svelte Whisper does **not** rely on compile-time integrations, routing manipulation, tree shaking dependencies, or heavy config maps. Its goal is strictly mapping dynamic dictionary values into memory securely & reactively without any configuration overhead for CSR SPAs.

## 🌐 Companion Localization Editor

Svelte Whisper includes a built-in, beautifully designed, purely client-side localization editor inspired by [Fink](https://fink.inlang.com/). This allows you to visually manage your JSON translation files directly from the browser!

### Features
- 🎨 **Material Design 3 Expressive**: A stunning, modern dark mode interface.
- 🔒 **Secure Client-Side Auth**: Connects directly to GitHub via Personal Access Tokens (PAT). Your token is only saved in your browser's local storage.
- 🚀 **Commit Directly**: Edit translations in a grid and push changes directly to your repository branches.

### How to use the Editor

The editor is hosted on GitHub Pages: **[Try the Editor](https://shilo.github.io/svelte-whisper/)**

1. Go to your GitHub account settings and create a **Personal Access Token (classic)** with the `repo` scope.
2. Open the editor and enter your Repository name (e.g. `Shilo/svelte-whisper`), Branch (e.g. `main`), and the PAT you just created.
3. Your standard JSON files stored in `src/locales` will be loaded into a visual grid! Edit away.

### Deploying the Editor to GitHub Pages

The editor comes with a pre-configured GitHub Action to automatically build and deploy itself to GitHub Pages whenever you push to `main`. 

To enable this:
1. Go to your repository on GitHub.
2. Click on **Settings** > **Pages** (under the "Code and automation" section).
3. Under **Build and deployment**, change the "Source" dropdown from "Deploy from a branch" to **"GitHub Actions"**.
4. That's it! GitHub Actions will now use the `.github/workflows/deploy-editor.yml` file to deploy the editor. Wait a few minutes for the action to finish running, and your editor will be live!

---

Built with ❤️ for the Svelte community.
