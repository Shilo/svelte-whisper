<script>
    // Neither runes nor legacy syntax: the compiler's `runes` option decides the mode.
    import { t, locale, formatNumber, formatPercent, formatDate } from 'svelte-whisper';

    const date = Date.UTC(2026, 2, 5, 12);
    const month = { month: 'long', timeZone: 'UTC' };
    const shout = translate => translate('hello').toUpperCase();
</script>

<p id="universal">{$t('hello')}|{$t('late')}|{$locale}|{$formatNumber(1234.5)}|{$formatPercent(0.5)}|{$formatDate(date, month)}|{$t('hello')}!|{shout($t)}|</p>
