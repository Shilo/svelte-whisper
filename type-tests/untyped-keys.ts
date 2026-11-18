// Without a registered dictionary, any string is a key.
import { tr, type WhisperKey } from 'svelte-whisper';

const key: WhisperKey = 'anything.at.all';
tr(key);
tr('free.form', { count: 1 });
