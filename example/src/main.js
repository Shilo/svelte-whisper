import { mount } from 'svelte';
import { init, registerLoader } from 'svelte-whisper';
import App from './App.svelte';
import './app.css';

// One lazy loader per file: ./locales/es.json becomes locale "es", fetched the first time it is needed.
registerLoader(import.meta.glob('./locales/*.json'));

// Starts with the saved choice, then the browser's language, then English.
// In `vite dev`, keys that are missing appear in a small overlay in the corner.
await init({ fallback: 'en', persistKey: 'whisper-demo-locale' });

mount(App, { target: document.getElementById('app') });
