<script>
    import { getLocales, localeName, locale } from 'svelte-whisper';
    import { downloads } from './downloads.svelte.js';

    let { onchoose } = $props();

    // Every locale with a registered loader, named in its own language.
    const locales = getLocales();
</script>

<ul class="gates">
    {#each locales as id (id)}
        {@const loaded = downloads.some(file => file.locale === id)}
        <li>
            <button aria-pressed={$locale === id} class:loaded onclick={() => onchoose(id)}>
                <span class="code" aria-hidden="true">{id}</span>
                <span class="name" lang={id} dir="auto">{localeName(id)}</span>
            </button>
        </li>
    {/each}
</ul>

<style>
    .gates {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    button {
        position: relative;
        display: grid;
        gap: 0.125rem;
        min-width: 4.5rem;
        padding: 0.4rem 0.7rem 0.45rem;
        border: 1.5px dashed var(--band-ink-2);
        border-radius: 4px;
        background: transparent;
        color: var(--band-ink);
        text-align: start;
        cursor: pointer;
        transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out;
    }
    /* Dashed until its file has been downloaded, solid after. */
    .loaded {
        border-style: solid;
        border-color: var(--band-ink-2);
    }
    button:hover {
        background: var(--band-hover);
    }
    /* You are here: the one place the signal colour is used. */
    button[aria-pressed='true'] {
        border-color: var(--signal);
        background: var(--signal);
        color: var(--on-signal);
    }
    button[aria-pressed='true']::after {
        content: '';
        position: absolute;
        inset-inline-start: 0.7rem;
        bottom: -0.45rem;
        border: 0.45rem solid transparent;
        border-bottom: 0;
        border-top-color: var(--signal);
    }
    .code {
        font: 600 0.6875rem/1 var(--mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.8;
    }
    .name {
        font-size: 0.9375rem;
        font-weight: 600;
        line-height: 1.3;
        white-space: nowrap;
    }

    @media (max-width: 30rem) {
        .gates { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.375rem; }
        button { min-width: 0; padding: 0.4rem 0.45rem; }
        .name { font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; }
    }
</style>
