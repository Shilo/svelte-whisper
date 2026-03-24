import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { init } from 'svelte-whisper';

// Initialize with missing key detection enabled.
// The dev overlay will appear in Vite dev mode showing any missing keys.
await init({ fallback: 'en', initial: 'en' });

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
