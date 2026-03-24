import { test, mock } from 'node:test';
import assert from 'node:assert';
import { get } from 'svelte/store';
import { init, addDictionary, registerLoader, setLocale, resetLocale, locale, t, tr, getLocales } from './index.js';

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

test('init with detect option falls back when no navigator', async () => {
    // Node has no navigator, so detect should fall back to fallback locale
    await init({ fallback: 'en', detect: { ja: 'jp', zh: 'zh' } });
    assert.strictEqual(get(locale), 'en');
});

test('detect maps navigator.language to locale', async () => {
    const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'ja-JP' },
        configurable: true,
        writable: true,
    });
    await init({ fallback: 'en', detect: { ja: 'jp' } });
    assert.strictEqual(get(locale), 'jp');
    if (origDescriptor) {
        Object.defineProperty(globalThis, 'navigator', origDescriptor);
    } else {
        delete globalThis.navigator;
    }
});

test('auto-detect matches registered locale from navigator.language', async () => {
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'ja-JP' },
        configurable: true,
        writable: true,
    });
    // No detect option — should auto-detect 'ja' from registered loaders
    await init({ fallback: 'en' });
    assert.strictEqual(get(locale), 'ja');
    if (origDescriptor) {
        Object.defineProperty(globalThis, 'navigator', origDescriptor);
    } else {
        delete globalThis.navigator;
    }
});

test('detect: false disables browser detection', async () => {
    const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'ja-JP' },
        configurable: true,
        writable: true,
    });
    await init({ fallback: 'en', detect: false });
    assert.strictEqual(get(locale), 'en');
    if (origDescriptor) {
        Object.defineProperty(globalThis, 'navigator', origDescriptor);
    } else {
        delete globalThis.navigator;
    }
});

test('resetLocale clears persistence and re-detects', async () => {
    // Mock localStorage
    const storage = {};
    globalThis.localStorage = {
        getItem: (k) => storage[k],
        setItem: (k, v) => storage[k] = v,
        removeItem: (k) => delete storage[k]
    };

    // Mock navigator
    const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'ja-JP' },
        configurable: true,
        writable: true,
    });

    try {
        await init({ fallback: 'en', persistKey: 'whisper-test' });

        // Change from detected 'ja' to 'es'
        addDictionary('es', { hello: 'Hola' });
        await setLocale('es');
        assert.strictEqual(get(locale), 'es');
        assert.strictEqual(storage['whisper-test'], 'es');

        // Reset
        await resetLocale();
        assert.strictEqual(get(locale), 'ja');
        assert.strictEqual(storage['whisper-test'], undefined);
    } finally {
        if (origDescriptor) {
            Object.defineProperty(globalThis, 'navigator', origDescriptor);
        } else {
            delete globalThis.navigator;
        }
        delete globalThis.localStorage;
    }
});

// ---------------------------------------------------------------------------
// Persistence & detection edge-case tests (v1.1.2 bug-fix coverage)
// ---------------------------------------------------------------------------

/**
 * Helper: run a test body with mocked navigator and localStorage, cleaning up
 * regardless of success/failure.
 */
async function withBrowserMocks({ languages, storage = {} }, fn) {
    const origNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { languages, language: languages[0] },
        configurable: true,
        writable: true,
    });
    globalThis.localStorage = {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = v; },
        removeItem: (k) => { delete storage[k]; },
    };
    try {
        await fn(storage);
    } finally {
        if (origNav) {
            Object.defineProperty(globalThis, 'navigator', origNav);
        } else {
            delete globalThis.navigator;
        }
        delete globalThis.localStorage;
    }
}

test('auto-detected locale is NOT persisted to localStorage', async () => {
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    await withBrowserMocks({ languages: ['ja-JP', 'en'] }, async (storage) => {
        await init({ fallback: 'en', persistKey: 'test-persist' });
        // Detection should pick 'ja' via prefix match on 'ja-JP'
        assert.strictEqual(get(locale), 'ja');
        // But auto-detected value must NOT be written to localStorage
        assert.strictEqual(storage['test-persist'], undefined,
            'auto-detected locale should not be persisted');
    });
});

test('explicit locale change IS persisted to localStorage', async () => {
    addDictionary('fr', { bonjour: 'Bonjour' });
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    await withBrowserMocks({ languages: ['ja-JP', 'en'] }, async (storage) => {
        await init({ fallback: 'en', persistKey: 'test-persist-explicit' });
        assert.strictEqual(get(locale), 'ja');
        assert.strictEqual(storage['test-persist-explicit'], undefined);

        // Simulate user explicitly choosing French
        await setLocale('fr');
        assert.strictEqual(storage['test-persist-explicit'], 'fr',
            'explicit locale change should be persisted');
    });
});

test('navigator.languages iterates full list to find a match', async () => {
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    // First preference (ko-KR) has no registered locale; second (ja-JP) does.
    await withBrowserMocks({ languages: ['ko-KR', 'ja-JP', 'en-US'] }, async () => {
        await init({ fallback: 'en' });
        assert.strictEqual(get(locale), 'ja',
            'should iterate navigator.languages and pick ja from second preference');
    });
});

test('exact ja-JP bug: stale "en" no longer blocks detection on return visit', async () => {
    // Scenario: first visit happened before Japanese was added.
    // Old code would have persisted "en" to localStorage.
    // After the fix + migration clears localStorage, detection should run fresh.
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    addDictionary('en', { hello: 'Hello' });

    // Simulate "return visit" with empty localStorage (migration cleared it)
    await withBrowserMocks({ languages: ['ja-JP', 'ja', 'en-US', 'en'] }, async (storage) => {
        await init({ fallback: 'en', persistKey: 'test-ja-bug' });
        // Should detect ja, not fall back to en
        assert.strictEqual(get(locale), 'ja',
            'with empty localStorage, browser detection should pick ja');
        // And it should NOT be persisted (auto-detected)
        assert.strictEqual(storage['test-ja-bug'], undefined,
            'auto-detected ja should not be persisted');
    });
});

test('persisted explicit choice is restored on subsequent init', async () => {
    addDictionary('fr', { bonjour: 'Bonjour' });
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    // Simulate: user previously chose 'fr' explicitly, it's in localStorage
    const preSeeded = { 'test-restore': 'fr' };
    await withBrowserMocks({ languages: ['ja-JP', 'en'] , storage: preSeeded }, async () => {
        await init({ fallback: 'en', persistKey: 'test-restore' });
        // Persisted value should win over browser detection
        assert.strictEqual(get(locale), 'fr',
            'persisted explicit choice should be restored, not overridden by detection');
    });
});

test('resetLocale does not persist the re-detected locale', async () => {
    addDictionary('fr', { bonjour: 'Bonjour' });
    registerLoader('ja', async () => ({ default: { hello: 'こんにちは' } }));
    await withBrowserMocks({ languages: ['ja-JP', 'en'] }, async (storage) => {
        await init({ fallback: 'en', persistKey: 'test-reset-persist' });
        assert.strictEqual(get(locale), 'ja');

        // User explicitly picks French
        await setLocale('fr');
        assert.strictEqual(storage['test-reset-persist'], 'fr');

        // Reset clears persistence and re-detects
        await resetLocale();
        assert.strictEqual(get(locale), 'ja',
            'after reset, should re-detect ja from browser');
        assert.strictEqual(storage['test-reset-persist'], undefined,
            'after reset, re-detected locale should not be persisted');

        // A subsequent explicit change should still persist
        await setLocale('en');
        assert.strictEqual(storage['test-reset-persist'], 'en',
            'explicit change after reset should still persist');
    });
});

// ---------------------------------------------------------------------------
// Missing key detection tests
// ---------------------------------------------------------------------------

test('onMissing callback fires for missing keys', async () => {
    const missing = [];
    await init({ fallback: 'en', initial: 'en', onMissing: (e) => missing.push(e) });
    addDictionary('en', { exists: 'yes' });

    get(t)('no.such.key');
    assert.strictEqual(missing.length, 1);
    assert.strictEqual(missing[0].key, 'no.such.key');
    assert.strictEqual(missing[0].locale, 'en');
});

test('onMissing is deduplicated per locale+key', async () => {
    const missing = [];
    await init({ fallback: 'en', initial: 'en', onMissing: (e) => missing.push(e) });

    get(t)('dup.key');
    get(t)('dup.key');
    get(t)('dup.key');
    assert.strictEqual(missing.length, 1, 'should only fire once for the same key+locale');
});

test('console.warn fires by default when no onMissing handler', async () => {
    const warnMock = mock.method(console, 'warn', () => {});
    await init({ fallback: 'en', initial: 'en' });

    get(t)('warn.test.key');
    const calls = warnMock.mock.calls;
    const found = calls.some(c => c.arguments[0]?.includes?.('warn.test.key'));
    assert.ok(found, 'console.warn should fire for missing key');
    warnMock.mock.restore();
});

test('onMissing suppresses default console.warn', async () => {
    const warnMock = mock.method(console, 'warn', () => {});
    await init({ fallback: 'en', initial: 'en', onMissing: () => {} });

    const before = warnMock.mock.callCount();
    get(t)('suppressed.key');
    assert.strictEqual(warnMock.mock.callCount(), before,
        'console.warn should not fire when onMissing handler is set');
    warnMock.mock.restore();
});

test('warn: false disables console.warn', async () => {
    const warnMock = mock.method(console, 'warn', () => {});
    await init({ fallback: 'en', initial: 'en', warn: false });

    const before = warnMock.mock.callCount();
    get(t)('silent.key');
    assert.strictEqual(warnMock.mock.callCount(), before,
        'console.warn should not fire when warn: false');
    warnMock.mock.restore();
});

test('onMissing tracks multiple distinct keys', async () => {
    const missing = [];
    await init({ fallback: 'en', initial: 'en', onMissing: (e) => missing.push(e) });

    get(t)('alpha');
    get(t)('beta');
    assert.strictEqual(missing.length, 2);
    assert.ok(missing.some(e => e.key === 'alpha'), 'should contain alpha');
    assert.ok(missing.some(e => e.key === 'beta'), 'should contain beta');
    assert.ok(missing.every(e => e.locale === 'en'), 'all should be locale en');
});

test('missing keys tracked across locale switches', async () => {
    const missing = [];
    await init({ fallback: 'en', initial: 'en', onMissing: (e) => missing.push(e) });
    addDictionary('es', { hola: 'Hola' });

    get(t)('only.in.en.missing');
    await setLocale('es');
    get(t)('only.in.es.missing');

    assert.ok(missing.some(e => e.key === 'only.in.en.missing' && e.locale === 'en'));
    assert.ok(missing.some(e => e.key === 'only.in.es.missing' && e.locale === 'es'));
});
