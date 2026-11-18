<script>
    // Small sign pictograms, drawn on a 24 × 24 grid with one stroke weight.
    const paths = {
        mark: 'M4 5h16v10.5H10.5L6 19.5v-4H4zM8 9h8M8 12h5',
        languages: 'M3.5 4.5h11v8H8l-3.5 3v-3h-1zM14.5 8.5h6v8h-1v3l-3.5-3h-4.5v-4',
        download: 'M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15',
        braces: 'M9 4.5c-2 0-2.5 1-2.5 3.5S6 12 4.5 12C6 12 6.5 13.5 6.5 16S7 19.5 9 19.5M15 4.5c2 0 2.5 1 2.5 3.5s.5 4 2 4c-1.5 0-2 1.5-2 4s-.5 3.5-2.5 3.5M12 12h.01',
        stack: 'M3.5 9.5h11v10h-11zM8 9.5V5h12.5v10h-6',
        percent: 'M18.5 5.5l-13 13M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
        detour: 'M5 19.5V11a4.5 4.5 0 0 1 4.5-4.5h10M15.5 2.5l4 4-4 4',
        absent: 'M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 16.8h.01',
        minus: 'M5.5 12h13',
        plus: 'M5.5 12h13M12 5.5v13',
        arrow: 'M4.5 12h15M13.5 6l6 6-6 6',
    };

    /** @type {{ name: keyof typeof paths }} */
    let { name } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" class:flip={name === 'arrow' || name === 'detour'}>
    {#if name === 'absent'}<rect x="3.5" y="3.5" width="17" height="17" rx="1" stroke-dasharray="3 2.6" />{/if}
    <path d={paths[name]} />
</svg>

<style>
    svg {
        width: 1em;
        height: 1em;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    /* Arrows point the way the text reads. */
    :global([dir='rtl']) .flip {
        scale: -1 1;
    }
</style>
