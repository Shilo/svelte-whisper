<script>
    import { t } from 'svelte-whisper';
    import Runes from './Runes.svelte';

    export let name = 'legacy parent';
</script>

<section aria-label={name}><Runes label={$t('hello')} /></section>
