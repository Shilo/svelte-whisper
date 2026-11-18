<script>
    import { t, formatNumber } from 'svelte-whisper';
    import Pictogram from './Pictogram.svelte';
    import { downloads } from './downloads.svelte.js';

    // formatNumber's `unit` style localizes the unit too: "1.2 kB", "1,2 ko", "1.2 كيلوبايت".
    /** @param {number} bytes */
    function size(bytes) {
        return bytes < 1024
            ? formatNumber(bytes, { style: 'unit', unit: 'byte', unitDisplay: 'narrow' })
            : formatNumber(bytes / 1024, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 });
    }
</script>

<section class="board" aria-labelledby="board-title">
    <h2 id="board-title">
        <Pictogram name="download" />
        <span>{$t('log.title')}</span>
        <span class="count">{formatNumber(downloads.length)}</span>
    </h2>
    <table>
        <thead>
            <tr>
                <th scope="col">{$t('log.file')}</th>
                <th scope="col">{$t('log.size')}</th>
                <th scope="col">{$t('log.when')}</th>
            </tr>
        </thead>
        <tbody aria-live="polite">
            {#each downloads as file (file.at)}
                <tr>
                    <td dir="ltr">{file.file}</td>
                    <td>{file.cached ? $t('log.cached') : size(file.bytes)}</td>
                    <td>{formatNumber(file.at / 1000, { style: 'unit', unit: 'second', maximumFractionDigits: 2 })}</td>
                </tr>
            {/each}
        </tbody>
    </table>
    <p class="note">{$t('log.note')}</p>
</section>

<style>
    .board {
        align-self: start;
        padding: 1.25rem 1.375rem 1.125rem;
        border: 1px solid var(--band-rule);
        border-radius: 6px;
        background: var(--band);
        color: var(--band-ink);
        box-shadow: var(--mounted);
    }
    h2 {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        margin: 0 0 0.875rem;
        font-size: 1.0625rem;
        font-weight: 700;
        line-height: 1.3;
    }
    h2 :global(svg) {
        font-size: 1.25rem;
        color: var(--signal);
    }
    .count {
        margin-inline-start: auto;
        min-width: 1.75rem;
        padding: 0.125rem 0.5rem;
        border-radius: 3px;
        background: var(--band-hover);
        font: 600 0.875rem/1.4 var(--mono);
        text-align: center;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font: 0.875rem/1.4 var(--mono);
        font-variant-numeric: tabular-nums;
    }
    th {
        padding: 0 0 0.375rem;
        color: var(--band-ink-2);
        font: 600 0.6875rem/1.2 var(--sans);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: start;
    }
    th + th, td + td {
        text-align: end;
        padding-inline-start: 0.75rem;
    }
    td {
        padding: 0.5rem 0;
        border-top: 1px solid var(--band-rule);
        white-space: nowrap;
    }
    td:first-child {
        text-align: start;
    }
    /* The arrival: a new row lights up in the signal colour and settles. */
    tbody tr {
        animation: arrive 1.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes arrive {
        from { background: color-mix(in oklch, var(--signal) 45%, transparent); }
    }
    .note {
        margin: 0.875rem 0 0;
        color: var(--band-ink-2);
        font-size: 0.8125rem;
        line-height: 1.5;
    }
    @media (prefers-reduced-motion: reduce) {
        tbody tr { animation-duration: 1ms; }
    }
</style>
