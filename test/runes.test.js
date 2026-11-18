// tr(), getLocale() and the formatters are plain functions that must re-run inside
// Svelte 5 reactive contexts. This compiles a tiny runes module and watches them in a real effect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { flushSync } from 'svelte';
import { load } from './helpers.js';

const source = `
    export function watch(fn) {
        return $effect.root(() => {
            $effect(() => { fn(); });
        });
    }
`;

async function runes() {
    // Compiled next to the tests so its `svelte` imports resolve to this project's copy.
    const dir = mkdtempSync(join(import.meta.dirname, '.runes-'));
    const file = join(dir, 'watch.js');
    writeFileSync(file, compileModule(source, { generate: 'client', filename: 'watch.svelte.js' }).js.code);
    try {
        return await import(pathToFileURL(file).href);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('plain function calls re-run in effects when the locale or a dictionary changes', async () => {
    const { watch } = await runes();
    const w = await load();
    w.addDictionary('en', { hello: 'Hello' });
    w.addDictionary('fr', { hello: 'Bonjour' });
    await w.init({ detect: false, warn: false });

    const seen = [];
    const stop = watch(() => {
        const line = [w.getLocale(), w.tr('hello'), w.formatNumber(1234.5), w.formatPercent(0.5)].join(' | ');
        seen.push(line.replace(/\s/g, ' ')); // French separators are non-breaking spaces
    });
    flushSync();
    await w.setLocale('fr');
    flushSync();
    w.addDictionary('fr', { hello: 'Salut' });
    flushSync();
    stop();
    await w.setLocale('en');
    flushSync();

    assert.deepEqual(seen, [
        'en | Hello | 1,234.5 | 50%',
        'fr | Bonjour | 1 234,5 | 50 %',
        'fr | Salut | 1 234,5 | 50 %',
    ]);
});

test('an explicit locale argument does not subscribe to the active locale', async () => {
    const { watch } = await runes();
    const w = await load();
    w.addDictionary('en', {});
    w.addDictionary('fr', {});
    await w.init({ detect: false });

    let runs = 0;
    const stop = watch(() => {
        runs++;
        w.formatNumber(1, undefined, 'de');
        w.localeName('ja');
    });
    flushSync();
    await w.setLocale('fr');
    flushSync();
    stop();

    assert.equal(runs, 1);
});
