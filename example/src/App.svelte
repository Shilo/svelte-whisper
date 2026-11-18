<script>
    import {
        t, locale, setLocale, resetLocale, getFallbackLocale,
        localeName, formatNumber, formatPercent, formatDate,
    } from 'svelte-whisper';
    import { greeting } from './greeting.js';
    import LanguageGates from './lib/LanguageGates.svelte';
    import DownloadBoard from './lib/DownloadBoard.svelte';
    import Sign from './lib/Sign.svelte';
    import Pictogram from './lib/Pictogram.svelte';

    const PERSIST_KEY = 'whisper-demo-locale'; // the same key passed to init() in main.js
    const today = new Date();

    let user = $state('Ada');
    let count = $state(1);
    let saved = $state(readSaved());

    $effect(() => {
        document.title = $t('meta.title');
    });

    function readSaved() {
        try {
            return localStorage.getItem(PERSIST_KEY);
        } catch {
            return null;
        }
    }

    /** @param {string} id */
    async function choose(id) {
        await setLocale(id); // remembered, because init() was given a persistKey
        saved = readSaved();
    }

    async function forget() {
        await resetLocale(); // clears the saved choice and picks again, like init() did
        saved = readSaved();
    }

    // The dictionary entry a count lands on: an exact "0", else the Intl plural category.
    const pluralKey = $derived(count === 0 ? '0' : new Intl.PluralRules($locale).select(count));
</script>

<header class="band">
    <p class="wordmark"><Pictogram name="mark" /> svelte-whisper</p>
    <nav aria-label={$t('nav.languages')}>
        <LanguageGates onchoose={choose} />
    </nav>
    <p class="size" dir="ltr">{$t('nav.size', { size: formatNumber(1.6) })}</p>
</header>

<main>
    <div class="top">
        <section class="welcome" aria-labelledby="welcome-title">
            <h1 id="welcome-title">
                <span class="hello">{greeting()}</span>
                <span class="speaks">{$t('hero.speaks', { language: localeName($locale) })}</span>
            </h1>
            <p class="lede">{$t('hero.lede')}</p>
            <div class="saved">
                <p>{saved ? $t('hero.saved') : $t('hero.unsaved')}</p>
                {#if saved}
                    <button class="button" onclick={forget}>{$t('hero.forget')}</button>
                {/if}
            </div>
        </section>
        <DownloadBoard />
    </div>

    <div class="signs">
        <Sign icon="braces" title={$t('greet.title')} span="major"
            call={["$t('greet.named', { user })", "$t('greet.positional', [user, localeName($locale)])"]}>
            <label class="field">
                <span>{$t('greet.label')}</span>
                <input bind:value={user} maxlength="32" autocomplete="off" spellcheck="false" />
            </label>
            <p class="sample">{$t('greet.named', { user })}</p>
            <p class="sample">{$t('greet.positional', [user, localeName($locale)])}</p>
        </Sign>

        <Sign icon="stack" title={$t('plural.title')} span="minor" call={["$t('plural.files', { count })"]}>
            <div class="counter">
                <button class="button" onclick={() => count--} disabled={count === 0}>
                    <Pictogram name="minus" /><span>{$t('plural.fewer')}</span>
                </button>
                <output aria-live="polite">{formatNumber(count)}</output>
                <button class="button" onclick={() => count++}>
                    <Pictogram name="plus" /><span>{$t('plural.more')}</span>
                </button>
            </div>
            <p class="sample">{$t('plural.files', { count })}</p>
            <p class="detail">{$t('plural.rule')}: <code dir="ltr">files.{pluralKey}</code></p>
        </Sign>

        <Sign icon="percent" title={$t('format.title')} span="wide">
            <dl class="readouts">
                <div>
                    <dt>{$t('format.number')}</dt>
                    <dd>{formatNumber(1234567.891)}</dd>
                    <code dir="ltr">formatNumber(1234567.891)</code>
                </div>
                <div>
                    <dt>{$t('format.price')}</dt>
                    <dd>{formatNumber(1499.5, { style: 'currency', currency: $t('format.currency') })}</dd>
                    <code dir="ltr">formatNumber(1499.5, {'{'} style: 'currency', … {'}'})</code>
                </div>
                <div>
                    <dt>{$t('format.share')}</dt>
                    <dd>{formatPercent(0.256, 1)}</dd>
                    <code dir="ltr">formatPercent(0.256, 1)</code>
                </div>
                <div>
                    <dt>{$t('format.date')}</dt>
                    <dd>{formatDate(today, { dateStyle: 'long' })}</dd>
                    <code dir="ltr">formatDate(today, {'{'} dateStyle: 'long' {'}'})</code>
                </div>
            </dl>
        </Sign>

        <Sign icon="detour" title={$t('fallback.title')} call={["$t('fallback.only_en')"]}>
            <!-- This key exists only in en.json; every other locale borrows it. -->
            <p class="sample" lang="en" dir="ltr">{$t('fallback.only_en')}</p>
            <p class="detail">
                {$locale === getFallbackLocale()
                    ? $t('fallback.native')
                    : $t('fallback.falls_back', { language: localeName($locale) })}
            </p>
        </Sign>

        <Sign icon="absent" title={$t('missing.title')} call={["$t('missing.coming_soon')"]}>
            <!-- This key exists in no file, on purpose. Your editor underlines it, too (see whisper.d.ts). -->
            <p class="absent" dir="ltr">{$t('missing.coming_soon')}</p>
            <p class="detail">{$t('missing.note')}</p>
        </Sign>
    </div>
</main>

<footer>
    <a href="https://github.com/Shilo/svelte-whisper/tree/main/example/src">
        {$t('footer.source')} <Pictogram name="arrow" />
    </a>
    <a href="https://github.com/Shilo/svelte-whisper">
        {$t('footer.repo')} <Pictogram name="arrow" />
    </a>
</footer>

<style>
    .band {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem 1.5rem;
        padding: 0.75rem var(--gutter) 0.875rem;
        border-bottom: 1px solid var(--band-rule);
        background: var(--band);
        color: var(--band-ink);
        --focus: var(--band-ink);
    }
    .wordmark {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        letter-spacing: -0.01em;
    }
    .wordmark :global(svg) {
        font-size: 1.5rem;
        color: var(--band-ink-2);
    }
    nav {
        margin-inline-start: auto;
    }
    .size {
        margin: 0;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--band-rule);
        border-radius: 3px;
        color: var(--band-ink-2);
        font: 0.8125rem/1.3 var(--mono);
        white-space: nowrap;
    }

    main {
        display: grid;
        gap: clamp(2rem, 5vw, 3.5rem);
        max-width: 76rem;
        margin: 0 auto;
        padding: clamp(2.25rem, 6vw, 4.5rem) var(--gutter) 3rem;
    }
    .top {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(19rem, 1fr);
        gap: clamp(1.5rem, 4vw, 3.5rem);
        align-items: start;
    }
    h1 {
        display: grid;
        gap: 0.75rem;
        margin: 0;
    }
    .hello {
        font-size: clamp(2.75rem, 1.5rem + 5.2vw, 5.5rem);
        font-weight: 800;
        line-height: 0.98;
        letter-spacing: -0.035em;
        text-wrap: balance;
    }
    .speaks {
        font-size: clamp(1.375rem, 1rem + 1.4vw, 2rem);
        font-weight: 500;
        line-height: 1.2;
        text-wrap: balance;
    }
    .lede {
        max-width: 34em;
        margin: 1.5rem 0 0;
        color: var(--ink-2);
        font-size: 1.125rem;
        line-height: 1.55;
        text-wrap: pretty;
    }
    .saved {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem 1rem;
        margin-top: 1.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--rule);
    }
    .saved p {
        margin: 0;
        font-size: 0.9375rem;
    }

    .signs {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 1.25rem;
    }
    .sample {
        margin: 0;
        font-size: 1.375rem;
        font-weight: 500;
        line-height: 1.35;
        text-wrap: pretty;
    }
    .detail {
        margin: 0;
        color: var(--ink-2);
        font-size: 0.9375rem;
        line-height: 1.5;
    }
    .detail code {
        color: var(--ink);
        font: 0.875rem var(--mono);
    }
    .field {
        display: grid;
        gap: 0.375rem;
        max-width: 20rem;
        font-size: 0.875rem;
        font-weight: 600;
    }
    .counter {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
    }
    output {
        min-width: 3ch;
        font: 700 2.25rem/1 var(--sans);
        font-variant-numeric: tabular-nums;
        text-align: center;
    }
    .absent {
        justify-self: start;
        margin: 0;
        padding: 0.5rem 0.75rem;
        border: 1.5px dashed var(--ink-2);
        border-radius: 4px;
        font: 1rem/1.4 var(--mono);
    }

    /* One readout board: label, figure and the call that made it, on a shared baseline. */
    .readouts {
        display: grid;
        margin: 0;
    }
    .readouts div {
        display: grid;
        grid-template-columns: minmax(6.5rem, 0.6fr) minmax(0, 1.6fr) minmax(0, 1.4fr);
        align-items: baseline;
        gap: 0.25rem 1.5rem;
        padding: 0.75rem 0;
        border-top: 1px solid var(--rule);
    }
    .readouts div:first-child {
        padding-top: 0;
        border-top: 0;
    }
    dt {
        color: var(--ink-2);
        font-weight: 600;
    }
    dd {
        margin: 0;
        font-size: clamp(1.5rem, 1.1rem + 1vw, 2rem);
        font-weight: 700;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
    }
    .readouts code {
        color: var(--ink-2);
        font: 0.8125rem/1.4 var(--mono);
        text-align: left;
    }

    footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 2rem;
        max-width: 76rem;
        margin: 0 auto;
        padding: 1.5rem var(--gutter) 3rem;
        border-top: 1px solid var(--rule);
    }
    footer a {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
    }

    @media (max-width: 60rem) {
        .top { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 62rem) {
        nav { order: 3; width: 100%; margin-inline-start: 0; }
        .size { margin-inline-start: auto; }
    }
    @media (max-width: 40rem) {
        .readouts div { grid-template-columns: minmax(0, 1fr); }
        .sample { font-size: 1.25rem; }
    }
</style>
