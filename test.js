import { test } from 'node:test';
import assert from 'node:assert';
import { get } from 'svelte/store';
import { init, addDictionary, registerLoader, setLocale, locale, t } from './index.js';

test('initialization and dictionary addition', async () => {
    init({ fallback: 'en', initial: 'en' });
    addDictionary('en', { hello: 'Hello', nested: { val: 'nested_val' } });

    assert.strictEqual(get(locale), 'en');
    assert.strictEqual(get(t)('hello'), 'Hello');
    assert.strictEqual(get(t)('nested.val'), 'nested_val');
});

test('interpolation positional properties', async () => {
    addDictionary('en', { msg: 'Hello {0}, {1}!' });
    assert.strictEqual(get(t)('msg', ['Alice', 'Bob']), 'Hello Alice, Bob!');
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
