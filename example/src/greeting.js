import { t } from 'svelte-whisper';

// A plain module can translate too. Called from markup, it re-runs when the locale changes.
export function greeting(date = new Date()) {
    const hour = date.getHours();
    return t(hour < 12 ? 'day.morning' : hour < 18 ? 'day.afternoon' : 'day.evening');
}
