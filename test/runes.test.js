// t(), getLocale() and the formatters are plain functions backed by one $state signal.
// These tests run them inside real Svelte effects and deriveds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { load, observe, derive, flushSync } from './helpers.js';
import { compile } from '../scripts/compile.js';

async function app() {
    const w = await load();
    w.addDictionary('en', { hello: 'Hello', items: { one: '{count} item', other: '{count} items' } });
    w.addDictionary('fr', { hello: 'Bonjour' });
    await w.init({ detect: false, warn: false });
    return w;
}

// French separators are non-breaking spaces whose code point depends on the ICU version.
const plain = text => text.replace(/\s/g, ' ');

test('everything that depends on the locale re-runs when it changes', async () => {
    const w = await app();
    const page = observe(() => plain([
        w.getLocale(),
        w.t('hello'),
        w.formatNumber(1234.5),
        w.formatNumber(0.5, { style: 'percent' }),
        w.formatDate(Date.UTC(2026, 2, 5, 12), { month: 'long', timeZone: 'UTC' }),
    ].join(' | ')));

    await w.setLocale('fr');
    page.flush();
    page.stop();
    await w.setLocale('en');
    page.flush();

    assert.deepEqual(page.seen, [
        'en | Hello | 1,234.5 | 50% | March',
        'fr | Bonjour | 1 234,5 | 50 % | mars',
    ], 'runs once per change, and not at all after it stops');
});

test('a dictionary change re-runs t() for the active and the fallback locale only', async () => {
    const w = await app();
    await w.setLocale('fr');
    const page = observe(() => `${w.t('hello')} ${w.t('items', { count: 2 })}`);

    w.addDictionary('fr', { hello: 'Salut' });      // active
    page.flush();
    w.addDictionary('en', { items: { other: '{count} things' } }); // fallback
    page.flush();
    w.addDictionary('ja', { hello: 'こんにちは' });   // neither
    page.flush();
    page.stop();

    assert.deepEqual(page.seen, ['Bonjour 2 items', 'Salut 2 items', 'Salut 2 things']);
});

test('$derived values built from t() stay current', async () => {
    const w = await app();
    const title = derive(() => w.t('hello').toUpperCase());
    const page = observe(() => title());
    await w.setLocale('fr');
    page.flush();
    page.stop();
    assert.deepEqual(page.seen, ['HELLO', 'BONJOUR']);
});

test('an explicit locale argument does not subscribe to the active locale', async () => {
    const w = await app();
    const page = observe(() => `${w.formatNumber(1, undefined, 'de')} ${w.localeName('ja')}`);
    await w.setLocale('fr');
    page.flush();
    page.stop();
    assert.equal(page.seen.length, 1);
});

test('changing i18n state inside an effect does not re-trigger that effect', async () => {
    const w = await app();
    let runs = 0;
    const page = observe(() => {
        runs++;
        w.addDictionary('en', { extra: 'Extra' });
        w.setLocale('fr');
    });
    page.flush();
    await Promise.resolve();
    flushSync();
    page.stop();
    assert.equal(runs, 1);
    assert.equal(w.getLocale(), 'fr');
});

test('a switch made while effects are running is seen by all of them', async () => {
    const w = await app();
    const first = observe(() => {
        if (w.getLocale() === 'fr') w.setLocale('en');
        return w.getLocale();
    });
    const second = observe(() => w.getLocale());
    await w.setLocale('fr');
    flushSync();
    first.stop();
    second.stop();
    assert.equal(w.getLocale(), 'en');
    assert.equal(first.seen.at(-1), 'en');
    assert.equal(second.seen.at(-1), 'en');
});

test('effects that stop are released', async () => {
    const w = await app();
    for (let i = 0; i < 1000; i++) observe(() => w.t('hello')).stop();
    const page = observe(() => w.t('hello'));
    await w.setLocale('fr');
    page.flush();
    page.stop();
    assert.deepEqual(page.seen, ['Hello', 'Bonjour']);
});

test('reactivity survives a minifier that runs before the Svelte plugin', async () => {
    // Vite 5 and 6.0 pass the module through esbuild before Svelte compiles it, and esbuild drops
    // a statement that only reads a value. The signal must be read where the result depends on it.
    const prepare = source => transformSync(source, { minifySyntax: true }).code;
    const w = await load({ prepare });
    w.addDictionary('en', { hello: 'Hello' });
    w.addDictionary('fr', { hello: 'Bonjour' });
    await w.init({ detect: false, warn: false });
    // One effect each: together, one that still reads the signal would keep the others updating.
    const pages = [
        observe(() => w.getLocale()),
        observe(() => w.t('hello')),
        observe(() => plain(w.formatNumber(1234.5))),
    ];
    await w.setLocale('fr');
    for (const page of pages) page.flush(), page.stop();
    assert.deepEqual(pages.map(page => page.seen), [['en', 'fr'], ['Hello', 'Bonjour'], ['1,234.5', '1 234,5']]);

    // And for any export added later: the minifier must not remove a single read of the signal.
    const reads = code => code.match(/\$\.get\(version\)/g)?.length;
    assert.ok(reads(compile()) > 0);
    assert.equal(reads(compile({ prepare })), reads(compile()), 'a read of the signal was dropped');
});
