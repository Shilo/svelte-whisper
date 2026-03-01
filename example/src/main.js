import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { locale } from 'svelte-whisper';

// Zero configuration needed!
// Svelte Whisper will automatically fetch `/locales/{lang}.json`
// when a locale is set, since no custom loaders were defined.
locale.set('en');

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
