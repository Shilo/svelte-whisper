// Without a registered dictionary, any string is a key.
import { t, type WhisperKey } from 'svelte-whisper';

const key: WhisperKey = 'anything.at.all';
t(key);
t('free.form', { count: 1 });
