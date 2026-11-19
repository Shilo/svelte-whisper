// Real components in each of the compiler's `runes` settings: legacy, runes and mixed trees
// must all follow a language switch. The fixtures are in test/fixtures/modes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile, VERSION } from 'svelte/compiler';
import { Window } from 'happy-dom';

// A DOM to mount into. Its globals go in before svelte loads: Svelte 5.0 reads requestAnimationFrame then.
const window = new Window();
for (const name of [
    'window', 'document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment', 'Event', 'CustomEvent',
    'DocumentFragment', 'HTMLTemplateElement', 'MutationObserver', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame',
]) {
    const value = name === 'window' ? window : window[name];
    // Window methods need their window as `this`; classes are taken as they are.
    const global = typeof value === 'function' && /^[a-z]/.test(name) ? value.bind(window) : value;
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: global });
}
const { mount, unmount } = await import('svelte');
const { fresh, emit, deferred, flushSync } = await import('./helpers.js');

const fixtures = new URL('./fixtures/modes/', import.meta.url);
// The syntax each fixture is written in. An app whose compiler setting disagrees marks such a
// component with <svelte:options runes={…} />, and so does this test. Universal has neither syntax.
const syntax = { Legacy: false, LegacyParent: false, Runes: true, RunesParent: true, Universal: undefined };
let build = 0;

/** Compile every fixture against `library`, the URL of a fresh library copy, and import the roots. */
async function components(runes, library) {
    const id = ++build;
    const url = {};
    // Children first, so a parent can import them by their compiled URL.
    for (const name of ['Legacy', 'Runes', 'Universal', 'LegacyParent', 'RunesParent']) {
        let source = readFileSync(new URL(`${name}.svelte`, fixtures), 'utf8');
        if (runes !== undefined && syntax[name] !== undefined && syntax[name] !== runes) {
            source = `<svelte:options runes={${syntax[name]}} />\n${source}`;
        }
        const code = compile(source, { filename: `${name}.svelte`, runes, generate: 'client' }).js.code
            .replace(/(['"])svelte-whisper\1/g, JSON.stringify(library))
            .replace(/(['"])\.\/(\w+)\.svelte\1/g, (_, quote, child) => JSON.stringify(url[child]));
        url[name] = emit(`${name}-${id}`, code);
    }
    return Promise.all(['LegacyParent', 'RunesParent', 'Universal'].map(async name => (await import(url[name])).default));
}

/** What every paragraph shows: hello|late|locale|number|percent|date|derived|helper|prop. */
function shows(locale, late, label = true) {
    const hello = locale === 'fr' ? 'Bonjour' : 'Hello';
    const formatted = locale === 'fr' ? '1 234,5|50 %|mars' : '1,234.5|50%|March';
    return `${hello}|${late}|${locale}|${formatted}|${hello}!|${hello.toUpperCase()}|${label ? hello : ''}`;
}

// Plain t() in legacy markup: since Svelte 5.34.4 the compiler reads a call there untracked, as
// Svelte 4 did, so it keeps its first value; before, it followed the locale. Neither is promised,
// which is why legacy components use $t. This notices if Svelte changes it again.
const [major, minor, patch] = VERSION.split('.').map(part => parseInt(part, 10));
const plainFollows = major === 5 && (minor < 34 || (minor === 34 && patch < 4));

for (const runes of [false, undefined, true]) {
    test(`components follow the locale with runes: ${runes}`, async () => {
        const library = fresh();
        const w = await import(library);
        const fallback = deferred();
        w.addDictionary('fr', { hello: 'Bonjour' });
        // English is the fallback, and it only arrives later.
        let asked = 0;
        w.registerLoader('en', () => (asked++, fallback.promise));
        await w.init({ initial: 'fr', detect: false, warn: false });
        const target = document.body.appendChild(document.createElement('main'));
        const roots = (await components(runes, library)).map(component => mount(component, { target }));
        try {
            flushSync();
            const text = selector => target.querySelector(selector).textContent.replace(/\s/g, ' ');
            const check = (locale, late, why) => {
                for (const id of ['#legacy', '#runes', '#runes-stores']) assert.equal(text(id), shows(locale, late), `${id} ${why}`);
                assert.equal(text('#universal'), shows(locale, late, false), `#universal ${why}`);
                assert.equal(target.querySelector('#legacy').title, shows(locale, late).split('|')[0], `use: action ${why}`);
                const plain = plainFollows ? shows(locale, late).split('|')[0] : 'Bonjour';
                assert.equal(text('#legacy-plain'), plain, `plain t() in legacy markup ${why}`);
            };
            check('fr', 'late', 'at start');

            // The first missing key asked for the fallback; the text heals when it arrives.
            assert.equal(asked, 1, 'a missing key asks for the fallback, once');
            fallback.resolve({ hello: 'Hello', late: 'Late' });
            await w.loadLocale('en');
            flushSync();
            check('fr', 'Late', 'after the fallback arrived');

            // bind:value={$locale} in the legacy component switches the language.
            const field = target.querySelector('input');
            assert.equal(field.value, 'fr');
            field.value = 'en';
            field.dispatchEvent(new window.Event('input', { bubbles: true }));
            flushSync();
            assert.equal(w.getLocale(), 'en');
            check('en', 'Late', 'after bind:value={$locale}');

            await w.setLocale('fr');
            flushSync();
            check('fr', 'Late', 'after setLocale()');
            assert.equal(field.value, 'fr', 'the bound field follows');
        } finally {
            for (const root of roots) unmount(root);
            target.remove();
        }
        assert.equal(target.innerHTML, '', 'unmounting removes everything');
    });
}
