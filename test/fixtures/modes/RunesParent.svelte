<script>
    import { t } from 'svelte-whisper';
    import Legacy from './Legacy.svelte';

    let { name = 'runes parent' } = $props();
</script>

<section aria-label={name}><Legacy label={t('hello')} /></section>
