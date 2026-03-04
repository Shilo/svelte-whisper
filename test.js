import { test } from 'node:test';
import assert from 'node:assert';
import { get } from 'svelte/store';
import { init, addDictionary, registerLoader, setLocale, locale, t, tr, getLocales } from './index.js';

test('initialization and dictionary addition', async () => {
    await init({ fallback: 'en', initial: 'en' });
    addDictionary('en', { hello: 'Hello', nested: { val: 'nested_val' } });

    assert.strictEqual(get(locale), 'en');
    assert.strictEqual(get(t)('hello'), 'Hello');
    assert.strictEqual(get(t)('nested.val'), 'nested_val');
});

test('interpolation positional properties', async () => {
    addDictionary('en', { msg: 'Hello {0}, {1}!' });
    assert.strictEqual(get(t)('msg', ['Alice', 'Bob']), 'Hello Alice, Bob!');
});

test('auto-positional interpolation', async () => {
    addDictionary('en', { msg: 'Supports {}, {}, and {}' });
    assert.strictEqual(get(t)('msg', ['a', 'b', 'c']), 'Supports a, b, and c');
});

test('interpolation named properties', async () => {
    addDictionary('en', { greet: 'Hello {user}!' });
    assert.strictEqual(get(t)('greet', { user: 'Charlie' }), 'Hello Charlie!');
});

test('fallback missing keys', async () => {
    addDictionary('es', { hola: 'Hola' });
    await setLocale('es');
    assert.strictEqual(get(locale), 'es');
    assert.strictEqual(get(t)('hola'), 'Hola');
    assert.strictEqual(get(t)('hello'), 'Hello'); // Falls back to en
});

test('missing key entirely', async () => {
    assert.strictEqual(get(t)('missing.key'), 'missing.key');
});

test('lazy loading properties', async () => {
    registerLoader('fr', async () => {
        return { default: { bonjour: 'Bonjour' } };
    });

    await setLocale('fr');
    assert.strictEqual(get(locale), 'fr');
    assert.strictEqual(get(t)('bonjour'), 'Bonjour');
    assert.strictEqual(get(t)('hello'), 'Hello'); // Falls back to en still
});

test('tr sync helper', async () => {
    await setLocale('en');
    addDictionary('en', { sync: 'Sync value' });
    assert.strictEqual(tr('sync'), 'Sync value');
    assert.strictEqual(tr('sync.missing'), 'sync.missing');
});

test('tr sync helper with interpolation', async () => {
    addDictionary('en', { greetSync: 'Hi {name}!' });
    assert.strictEqual(tr('greetSync', { name: 'Alice' }), 'Hi Alice!');
});

test('getLocales returns registered loader keys', () => {
    // 'fr' was registered in earlier test
    const locales = getLocales();
    assert.ok(locales.includes('fr'));
    assert.ok(!locales.includes('nonexistent'));
});

test('getLocales includes dictionary-only locales', () => {
    // 'es' was added via addDictionary (not registerLoader) in an earlier test
    const locales = getLocales();
    assert.ok(locales.includes('es'), 'es should be in getLocales() since it was added via addDictionary');
    assert.ok(locales.includes('en'), 'en should be in getLocales() since it was added via addDictionary');
    assert.ok(locales.includes('fr'), 'fr should still be in getLocales() from registerLoader');
});
