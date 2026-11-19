<script>
    // Legacy syntax on purpose: `export let` and `$:` put this component in legacy mode.
    import { t, locale, formatNumber, formatPercent, formatDate } from 'svelte-whisper';

    export let label = '';
    const date = Date.UTC(2026, 2, 5, 12);
    const month = { month: 'long', timeZone: 'UTC' };
    // A helper of your own is a plain function: handed $t, it runs again when $t changes.
    const shout = translate => translate('hello').toUpperCase();
    // An action is updated when its parameter changes.
    function title(node, text) {
        node.title = text;
        return { update: next => { node.title = next; } };
    }

    $: greeting = $t('hello') + '!';
</script>

<p id="legacy" use:title={$t('hello')}>{$t('hello')}|{$t('late')}|{$locale}|{$formatNumber(1234.5)}|{$formatPercent(0.5)}|{$formatDate(date, month)}|{greeting}|{shout($t)}|{label}</p>
<!-- Plain t() in legacy markup is read once and does not update. -->
<p id="legacy-plain">{t('hello')}</p>
<!-- A text field rather than a <select>: happy-dom does not match :checked, which Svelte reads from a select. -->
<input bind:value={$locale} />
