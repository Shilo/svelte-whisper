<script>
    import Pictogram from './Pictogram.svelte';

    /** `call` is the line of code that produced what the sign shows. */
    let { icon, title, call = [], span = 'half', children } = $props();
    const id = $props.id();
</script>

<section class="sign {span}" aria-labelledby={id}>
    <h2 {id}><span class="plate"><Pictogram name={icon} /></span>{title}</h2>
    <div class="body">{@render children()}</div>
    {#if call.length}
        <p class="call" dir="ltr">
            {#each call as line}<code>{line}</code>{/each}
        </p>
    {/if}
</section>

<style>
    .sign {
        grid-column: span 6;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem 1.5rem 1.25rem;
        background: var(--panel);
        border: 1px solid var(--rule);
        border-radius: 6px;
        box-shadow: var(--mounted);
    }
    .wide { grid-column: 1 / -1; }
    .major { grid-column: span 7; }
    .minor { grid-column: span 5; }

    h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        line-height: 1.25;
    }
    .plate {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        flex: none;
        border-radius: 4px;
        background: var(--ink);
        color: var(--panel);
        font-size: 1.375rem;
    }
    .body {
        display: grid;
        gap: 0.75rem;
        align-content: start;
    }
    .call {
        display: grid;
        gap: 0.25rem;
        margin: auto 0 0;
        padding-top: 0.875rem;
        border-top: 1px dashed var(--rule);
        color: var(--ink-2);
        font: 0.8125rem/1.5 var(--mono);
        text-align: left;
        overflow-wrap: anywhere;
    }

    @media (max-width: 44rem) {
        .sign, .major, .minor { grid-column: 1 / -1; }
        .sign { padding: 1.125rem 1.125rem 1rem; }
    }
</style>
