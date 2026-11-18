<script>
    import Pictogram from './Pictogram.svelte';

    /** `call` is the line of code that produced what the sign shows. */
    let { icon, title, call = [], span = 'half', children } = $props();
    const id = $props.id();
</script>

<section class="sign {span}" aria-labelledby={id}>
    <h2 {id}><Pictogram name={icon} />{title}</h2>
    <div class="body">
        {@render children()}
        {#if call.length}
            <p class="call" dir="ltr">
                {#each call as line}<code>{line}</code>{/each}
            </p>
        {/if}
    </div>
</section>

<style>
    /* A sign is a flat enamel plate: an ink legend strip over a plain field. No card chrome. */
    .sign {
        grid-column: span 6;
        align-self: start;
        overflow: hidden;
        border-radius: 4px;
        background: var(--panel);
    }
    .wide { grid-column: 1 / -1; }
    .major { grid-column: span 7; }
    .minor { grid-column: span 5; }

    h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        padding: 0.875rem 1.5rem;
        background: var(--band);
        color: var(--band-ink);
        font-size: clamp(1.375rem, 1.1rem + 0.8vw, 1.75rem);
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.01em;
    }
    h2 :global(svg) {
        font-size: 1.4em;
    }
    .body {
        display: grid;
        gap: 0.875rem;
        padding: 1.375rem 1.5rem 1.25rem;
    }
    .call {
        display: grid;
        gap: 0.25rem;
        margin: 0.25rem 0 0;
        padding-top: 0.875rem;
        border-top: 1px dashed var(--rule);
        color: var(--ink-2);
        font: 0.8125rem/1.5 var(--mono);
        text-align: left;
        overflow-wrap: anywhere;
    }

    @media (max-width: 60rem) {
        .major, .minor { grid-column: span 6; }
    }
    @media (max-width: 44rem) {
        .sign, .major, .minor { grid-column: 1 / -1; }
        h2 { padding: 0.75rem 1.125rem; }
        .body { padding: 1.125rem 1.125rem 1rem; }
    }
</style>
