<svelte:options runes={false} />

<script>
    // Legacy syntax on purpose: Svelte follows only stores in this mode, so each call gets a `$` in front.
    import { t, locale, formatNumber } from 'svelte-whisper';

    export let count;
</script>

<p class="sample">{$t('plural.files', { count })} · {$formatNumber(count / 3, { maximumFractionDigits: 2 })}</p>
<p class="detail">{$t('legacy.locale', { locale: $locale })}</p>

<style>
    p {
        margin: 0;
    }
    .sample {
        font-size: 1.375rem;
        font-weight: 500;
    }
    .detail {
        color: var(--ink-2);
        font-size: 0.9375rem;
    }
</style>
