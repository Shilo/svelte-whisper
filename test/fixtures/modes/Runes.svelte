<script>
    import { t, getLocale, locale, formatNumber, formatPercent, formatDate } from 'svelte-whisper';

    let { label = '' } = $props();
    const date = Date.UTC(2026, 2, 5, 12);
    const month = { month: 'long', timeZone: 'UTC' };
    const shout = translate => translate('hello').toUpperCase();
    const greeting = $derived(t('hello') + '!');
    const stored = $derived($t('hello') + '!');
</script>

<p id="runes">{t('hello')}|{t('late')}|{getLocale()}|{formatNumber(1234.5)}|{formatPercent(0.5)}|{formatDate(date, month)}|{greeting}|{shout(t)}|{label}</p>
<!-- The `$` forms work in a runes component too. -->
<p id="runes-stores">{$t('hello')}|{$t('late')}|{$locale}|{$formatNumber(1234.5)}|{$formatPercent(0.5)}|{$formatDate(date, month)}|{stored}|{shout($t)}|{label}</p>
