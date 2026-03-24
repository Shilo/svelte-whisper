# Svelte Whisper Demo 🤫

This directory contains a **Svelte 5 + Vite** sample project demonstrating the seamless UI integration of `svelte-whisper`. 

## Concept

This Single Page Application demonstrates:
1. Utilizing the `$t` localized store variable across components.
2. Handling deeply nested dictionaries & dictionary missing-key fallbacks.
3. Showcasing reactive language shifting.
4. Using dynamic language chunking via internal Vite dynamic imports mechanism (`() => import('./locales/es.json')`). Notice the Network Tab lazily pulling `es.json`!
5. Real-time interpolation updates via Svelte 5 `$state` data bindings (modifying local inputs updates translations instantly).
6. Auto-positional interpolation formatting using empty `{}` tags.
7. **Missing key detection & dev overlay**: The app references `$t('app.coming_soon')` which doesn't exist in any locale file. In dev mode, a floating amber badge appears in the bottom-right corner collecting missing keys — click it to expand the panel, click any key to copy it.

## Setup and Run

Install dependencies inside the `example` folder (which points to the immediate local `svelte-whisper` package sibling directory).

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to interact with the demo!

### Project Structure Breakdown:

- **`src/locales/`**: Includes our `en.json`, `es.json`, and `fr.json` language assets mapping our translation layers.
- **`src/main.js`**: Initializes `svelte-whisper` with `init()` which enables missing key detection and the dev overlay.
- **`src/App.svelte`**: Simple, reactive Svelte 5 component invoking the localized `{$t}` strings and mutating state via `$locale`. Includes a deliberate missing key (`app.coming_soon`) to demonstrate the dev overlay.
