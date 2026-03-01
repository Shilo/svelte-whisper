# Svelte Whisper Demo 🤫

This directory contains a **Svelte 5 + Vite** sample project demonstrating the seamless UI integration of `svelte-whisper`. 

## Concept

This Single Page Application demonstrates:
1. Utilizing the `$t` localized store variable across components.
2. Handling deeply nested dictionaries & dictionary missing-key fallbacks.
3. Showcasing reactive language shifting.
4. Using dynamic language chunking via internal Vite dynamic imports mechanism (`() => import('./locales/es.json')`). Notice the Network Tab lazily pulling `es.json`!

## Setup and Run

Install dependencies inside the `example` folder (which points to the immediate local `svelte-whisper` package sibling directory).

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to interact with the demo!

### Project Structure Breakdown:

- **`src/locales/`**: Includes our `en.json`, `es.json`, and `fr.json` language assets mapping our translation layers.
- **`src/main.js`**: Contains the `svelte-whisper` `init()`, `addDictionary()` direct injection setup, and lazy `registerLoader()` configs. 
- **`src/App.svelte`**: Simple, reactive Svelte 5 component invoking the localized `{$$t}` strings and mutating state via `$locale`.
