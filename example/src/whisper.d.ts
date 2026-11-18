// Typed keys: `$t('…')` and `tr('…')` now autocomplete from the English file,
// and a typo is underlined in the editor. Types only, nothing ships to the browser.
import type en from './locales/en.json';

declare module 'svelte-whisper' {
    interface Register {
        dictionary: typeof en;
    }
}
