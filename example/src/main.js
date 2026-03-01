import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

import { init, addDictionary, registerLoader } from 'svelte-whisper';
import enDict from './locales/en.json';

// Bundle English directly for fast initial load
addDictionary('en', enDict);

// Lazy load other languages
registerLoader('es', () => import('./locales/es.json'));
registerLoader('fr', () => import('./locales/fr.json'));

init({
  fallback: 'en',
  initial: 'en'
});

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
