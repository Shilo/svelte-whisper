import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, observe, withGlobals, browser, storage, deferred, captureConsole } from './helpers.js';

/** A library instance with English active and no browser detection. */
async function english(dict = {}, options = {}) {
    const w = await load();
    w.addDictionary('en', dict);
    await w.init({ detect: false, warn: false, ...options });
    return w;
}

describe('translation', () => {
    test('resolves flat, nested and literal dotted keys', async () => {
        const w = await english({
            hello: 'Hello',
            app: { ui: { title: 'Title' } },
            'flat.dotted': 'Flat',
        });
        assert.equal(w.t('hello'), 'Hello');
        assert.equal(w.t('app.ui.title'), 'Title');
        assert.equal(w.t('flat.dotted'), 'Flat');
    });

    test('returns the key itself when nothing matches', async () => {
        const w = await english({ app: { title: 'Title' } });
        assert.equal(w.t('nope'), 'nope');
        assert.equal(w.t('app.title.deeper'), 'app.title.deeper');
        assert.equal(w.t(''), '');
    });

    test('never resolves keys from Object.prototype', async () => {
        const w = await english({ real: 'yes' });
        for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            assert.equal(w.t(key), key);
        }
    });

    test('returns arrays and objects as they are, and indexes into arrays', async () => {
        const w = await english({ rules: ['One', 'Two'] });
        assert.deepEqual(w.t('rules'), ['One', 'Two']);
        assert.equal(w.t('rules.1'), 'Two');
    });

    test('falls back to the fallback locale for missing keys', async () => {
        const w = await english({ hello: 'Hello', shared: 'English' });
        w.addDictionary('es', { shared: 'Español' });
        await w.setLocale('es');
        assert.equal(w.t('shared'), 'Español');
        assert.equal(w.t('hello'), 'Hello');
    });

    test('uses the fallback dictionary before any locale is active', async () => {
        const w = await load();
        w.addDictionary('en', { hello: 'Hello' });
        assert.equal(w.getLocale(), '');
        assert.equal(w.t('hello'), 'Hello');
    });

    test('a null value counts as not translated', async () => {
        const w = await english({ hello: 'Hello', nav: { home: 'Home' } });
        w.addDictionary('fr', { hello: null, nav: { home: null } });
        await w.setLocale('fr');
        assert.equal(w.t('hello'), 'Hello');
        assert.equal(w.t('nav.home'), 'Home');
    });

    test('addDictionary merges deeply into an existing locale', async () => {
        const w = await english({ app: { title: 'Title' } });
        w.addDictionary('en', { app: { subtitle: 'Subtitle' } });
        assert.equal(w.t('app.title'), 'Title');
        assert.equal(w.t('app.subtitle'), 'Subtitle');
    });
});

describe('interpolation', () => {
    test('named, indexed and auto-positional placeholders', async () => {
        const w = await english({
            named: 'Hello {user}!',
            indexed: '{1} before {0}',
            auto: 'Supports {}, {} and {}',
            spaced: 'Hello { user }!',
            repeat: '{x}-{x}',
        });
        assert.equal(w.t('named', { user: 'Ada' }), 'Hello Ada!');
        assert.equal(w.t('indexed', ['a', 'b']), 'b before a');
        assert.equal(w.t('auto', ['a', 'b', 'c']), 'Supports a, b and c');
        assert.equal(w.t('spaced', { user: 'Ada' }), 'Hello Ada!');
        assert.equal(w.t('repeat', { x: 1 }), '1-1');
    });

    test('renders falsy values and leaves unknown placeholders visible', async () => {
        const w = await english({ msg: '{a}|{b}|{c}|{d}' });
        assert.equal(w.t('msg', { a: 0, b: false, c: '' }), '0|false||{d}');
        assert.equal(w.t('msg', { a: null, b: undefined, c: 1, d: 2 }), '{a}|{b}|1|2');
    });

    test('leaves text untouched without vars or with unbalanced braces', async () => {
        const w = await english({ raw: 'Hello {user}!', open: 'a { b', close: 'a } b {x}' });
        assert.equal(w.t('raw'), 'Hello {user}!');
        assert.equal(w.t('open', { b: 1 }), 'a { b');
        assert.equal(w.t('close', { x: 1 }), 'a } b 1');
    });

    test('does not re-scan substituted values', async () => {
        const w = await english({ msg: '{a} {b}' });
        assert.equal(w.t('msg', { a: '{b}', b: 'B' }), '{b} B');
    });
});

describe('plurals', () => {
    const items = { items: { 0: 'No items', one: '{count} item', other: '{count} items' } };

    test('selects by exact count, then plural category, then other', async () => {
        const w = await english(items);
        assert.equal(w.t('items', { count: 0 }), 'No items');
        assert.equal(w.t('items', { count: 1 }), '1 item');
        assert.equal(w.t('items', { count: 5 }), '5 items');
    });

    test('follows the plural rules of the active locale', async () => {
        const w = await english();
        w.addDictionary('ru', { files: { one: '{count} файл', few: '{count} файла', many: '{count} файлов', other: '{count} файла' } });
        await w.setLocale('ru');
        assert.equal(w.t('files', { count: 1 }), '1 файл');
        assert.equal(w.t('files', { count: 3 }), '3 файла');
        assert.equal(w.t('files', { count: 5 }), '5 файлов');
        assert.equal(w.t('files', { count: 21 }), '21 файл');
    });

    test('uses other when the category has no entry', async () => {
        const w = await english({ items: { other: '{count} items' } });
        assert.equal(w.t('items', { count: 1 }), '1 items');
    });

    test('text taken from the fallback uses the plural rules of the fallback language', async () => {
        const w = await english({ items: { one: '{count} item', other: '{count} items' } });
        w.addDictionary('fr', {});
        await w.setLocale('fr');
        // French counts 0 as "one"; the English sentence must still read "0 items".
        assert.equal(w.t('items', { count: 0 }), '0 items');
    });

    test('does not throw for a locale id that is not a valid language tag', async () => {
        const w = await english();
        w.addDictionary('not_a_tag', items);
        await w.setLocale('not_a_tag');
        assert.equal(w.t('items', { count: 5 }), '5 items');
    });
});

describe('loading', () => {
    test('a loader runs once, on first use, and module defaults are unwrapped', async () => {
        const w = await english({ hello: 'Hello' });
        let calls = 0;
        w.registerLoader('fr', async () => { calls++; return { default: { hello: 'Bonjour' } }; });
        assert.equal(calls, 0);
        assert.equal(await w.setLocale('fr'), true);
        await w.setLocale('en');
        await w.setLocale('fr');
        assert.equal(calls, 1);
        assert.equal(w.t('hello'), 'Bonjour');
    });

    test('a dictionary may have a top-level "default" group', async () => {
        const w = await english();
        w.registerLoader('fr', async () => ({ default: { label: 'Défaut' }, other: 'Autre' }));
        await w.setLocale('fr');
        assert.equal(w.t('default.label'), 'Défaut');
        assert.equal(w.t('other'), 'Autre');
    });

    test('unwraps an ES module namespace', async () => {
        const w = await english();
        const namespace = Object.defineProperty(
            { default: { hello: 'Bonjour' }, hello: 'Bonjour' }, Symbol.toStringTag, { value: 'Module' },
        );
        w.registerLoader('fr', async () => namespace);
        await w.setLocale('fr');
        assert.equal(w.t('hello'), 'Bonjour');
        assert.equal(w.t('default.hello'), 'default.hello');
    });

    test('a dictionary may have a top-level "default" string', async () => {
        const w = await english();
        w.registerLoader('fr', async () => ({ default: 'Défaut', other: 'Autre' }));
        await w.setLocale('fr');
        assert.equal(w.t('default'), 'Défaut');
        assert.equal(w.t('other'), 'Autre');
    });

    test('registers a whole glob, naming locales after their files', async () => {
        const w = await english();
        w.registerLoader({
            './locales/fr.json': async () => ({ default: { hello: 'Bonjour' } }),
            '../i18n/pt-BR.json': async () => ({ default: { hello: 'Olá' } }),
            '/src/locales/zh-Hant.json5': async () => ({ hello: '你好' }),
        });
        assert.deepEqual(w.getLocales().sort(), ['en', 'fr', 'pt-BR', 'zh-Hant']);
        await w.setLocale('pt-BR');
        assert.equal(w.t('hello'), 'Olá');
    });

    test('concurrent requests for one locale share a single load', async () => {
        const w = await english();
        let calls = 0;
        w.registerLoader('fr', async () => { calls++; return { hello: 'Bonjour' }; });
        await Promise.all([w.loadLocale('fr'), w.loadLocale('fr'), w.setLocale('fr')]);
        assert.equal(calls, 1);
    });

    test('loadLocale preloads without switching', async () => {
        const w = await english();
        w.registerLoader('fr', async () => ({ hello: 'Bonjour' }));
        assert.equal(await w.loadLocale('fr'), true);
        assert.equal(w.getLocale(), 'en');
    });

    test('a failed load keeps the current locale and can be retried', async () => {
        const w = await english({ hello: 'Hello' });
        let online = false;
        w.registerLoader('fr', async () => {
            if (!online) throw new Error('offline');
            return { hello: 'Bonjour' };
        });
        const errors = await captureConsole('error', async () => {
            assert.equal(await w.setLocale('fr'), false);
        });
        assert.equal(errors.length, 1);
        assert.match(errors[0][0], /Failed to load locale "fr"/);
        assert.equal(w.getLocale(), 'en');
        assert.equal(w.t('hello'), 'Hello');

        online = true;
        assert.equal(await w.setLocale('fr'), true);
        assert.equal(w.t('hello'), 'Bonjour');
    });

    test('the last setLocale call wins, whatever order the loads finish in', async () => {
        const w = await english({ hello: 'Hello' });
        const ja = deferred();
        w.registerLoader('ja', () => ja.promise);
        w.registerLoader('fr', async () => ({ hello: 'Bonjour' }));

        const first = w.setLocale('ja');
        const second = w.setLocale('fr');
        assert.equal(await second, true);
        ja.resolve({ hello: 'こんにちは' });
        assert.equal(await first, false);
        assert.equal(w.getLocale(), 'fr');
        assert.equal(w.t('hello'), 'Bonjour');
    });

    test('switching to a locale already in memory is synchronous', async () => {
        const w = await load();
        w.addDictionary('en', { hello: 'Hello' });
        w.addDictionary('fr', { hello: 'Bonjour' });
        w.init({ detect: false });
        assert.equal(w.getLocale(), 'en');
        w.setLocale('fr');
        assert.equal(w.t('hello'), 'Bonjour');
    });

    test('locale ids named like Object.prototype members are ordinary ids', async () => {
        const w = await english({ hello: 'Hello' });
        w.registerLoader('fr', async () => ({}));
        for (const id of ['toString', 'constructor', '__proto__']) {
            assert.equal(await w.setLocale(id), false);
        }
        assert.equal(w.getLocale(), 'en');
        w.addDictionary('constructor', { hello: 'Built' });
        assert.equal(await w.setLocale('constructor'), true);
        assert.equal(w.t('hello'), 'Built');
        assert.equal((await captureConsole('warn', () => w.t('nope'))).length, 0);
    });

    test('an unknown locale is refused once loaders are registered', async () => {
        const w = await english();
        w.registerLoader('fr', async () => ({}));
        await withGlobals({ fetch: () => assert.fail('must not fetch') }, async () => {
            assert.equal(await w.setLocale('xx'), false);
        });
        assert.equal(w.getLocale(), 'en');
    });
});

describe('zero-config fetch', () => {
    const respond = files => async url => {
        const body = files[url];
        return { ok: body !== undefined, json: async () => body };
    };

    test('fetches /locales/{locale}.json when no loaders are registered', async () => {
        const w = await load();
        const requested = [];
        const fetch = url => { requested.push(url); return respond({ '/locales/en.json': { hello: 'Hello' } })(url); };
        await withGlobals({ fetch }, async () => {
            assert.equal(await w.setLocale('en'), true);
            assert.equal(await w.setLocale('xx'), false);
        });
        assert.deepEqual(requested, ['/locales/en.json', '/locales/xx.json']);
        assert.equal(w.t('hello'), 'Hello');
        assert.equal(w.getLocale(), 'en');
    });

    test('a response that is not JSON is reported and refused', async () => {
        const w = await load();
        const fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } });
        await withGlobals({ fetch }, async () => {
            const errors = await captureConsole('error', async () => {
                assert.equal(await w.setLocale('en'), false);
            });
            assert.equal(errors.length, 1);
        });
    });
});

describe('lazy fallback', () => {
    test('loads a lazily registered fallback on the first missing key, once', async () => {
        const w = await load();
        let calls = 0;
        w.registerLoader('en', async () => { calls++; return { hello: 'Hello', only: 'Only English' }; });
        w.registerLoader('ja', async () => ({ hello: 'こんにちは' }));
        await w.init({ fallback: 'en', initial: 'ja', detect: false, warn: false });
        assert.equal(calls, 0, 'a complete translation never downloads the fallback');
        assert.equal(w.t('hello'), 'こんにちは');

        const page = observe(() => w.t('only'));
        await w.loadLocale('en');
        page.flush();
        page.stop();
        assert.equal(calls, 1);
        assert.deepEqual(page.seen, ['only', 'Only English'], 'the text heals itself once the fallback arrives');
    });

    test('does not retry a fallback that cannot be loaded', async () => {
        const w = await load();
        let calls = 0;
        w.registerLoader('en', async () => { calls++; throw new Error('offline'); });
        w.registerLoader('ja', async () => ({}));
        await captureConsole('error', async () => {
            await w.init({ initial: 'ja', detect: false, warn: false });
            w.t('a');
            await Promise.resolve();
            w.t('b');
            await new Promise(resolve => setTimeout(resolve));
        });
        assert.equal(calls, 1);
    });
});

describe('choosing the starting locale', () => {
    async function app() {
        const w = await load();
        w.addDictionary('en', { hello: 'Hello' });
        w.addDictionary('fr', { hello: 'Bonjour' });
        w.registerLoader('ja', async () => ({ hello: 'こんにちは' }));
        return w;
    }

    test('stored choice beats detection, initial and fallback', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ja-JP'), localStorage: storage({ key: 'fr' }) }, async () => {
            await w.init({ persistKey: 'key', initial: 'en' });
            assert.equal(w.getLocale(), 'fr');
        });
    });

    test('detection beats initial, initial beats fallback', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ja-JP') }, async () => {
            await w.init({ initial: 'fr' });
            assert.equal(w.getLocale(), 'ja');
        });
        await withGlobals({ navigator: browser('ko-KR') }, async () => {
            await w.init({ initial: 'fr' });
            assert.equal(w.getLocale(), 'fr');
            await w.init({});
            assert.equal(w.getLocale(), 'en');
        });
    });

    test('detect: false ignores the browser', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ja-JP') }, async () => {
            await w.init({ detect: false });
            assert.equal(w.getLocale(), 'en');
        });
    });

    test('a candidate that cannot be loaded falls through to the next', async () => {
        const w = await app();
        w.registerLoader('de', async () => { throw new Error('offline'); });
        await withGlobals({ navigator: browser('ko-KR'), localStorage: storage({ key: 'de' }) }, async () => {
            await captureConsole('error', () => w.init({ persistKey: 'key', initial: 'fr' }));
            assert.equal(w.getLocale(), 'fr');
            assert.equal(localStorage.data.key, 'de', 'the stored choice survives a failed load');
        });
    });

    test('a stored locale that no longer exists is ignored', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ko-KR'), localStorage: storage({ key: 'removed' }) }, async () => {
            await w.init({ persistKey: 'key' });
            assert.equal(w.getLocale(), 'en');
        });
    });

    test('still ends on the fallback id when nothing can be loaded', async () => {
        const w = await load();
        w.registerLoader('fr', async () => ({}));
        await w.init({ fallback: 'en', detect: false, warn: false });
        assert.equal(w.getLocale(), 'en');
        w.addDictionary('en', { hello: 'Hello' });
        assert.equal(w.t('hello'), 'Hello');
    });

    test('init without a fallback option returns to the default', async () => {
        const w = await app();
        await w.init({ fallback: 'fr', initial: 'ja', detect: false, warn: false });
        assert.equal(w.t('hello'), 'こんにちは');
        assert.equal(w.t('only_fr'), 'only_fr');
        w.addDictionary('fr', { only: 'Seulement' });
        w.addDictionary('en', { only: 'Only' });
        assert.equal(w.t('only'), 'Seulement');
        await w.init({ initial: 'ja', detect: false, warn: false });
        assert.equal(w.t('only'), 'Only');
    });

    test('init is synchronous when the chosen dictionary is in memory', async () => {
        const w = await app();
        w.init({ detect: false });
        assert.equal(w.getLocale(), 'en');
        assert.equal(w.t('hello'), 'Hello');
    });

    test('a setLocale call made while init is loading is not overridden', async () => {
        const w = await app();
        const slow = deferred();
        w.registerLoader('de', () => slow.promise);
        const ready = w.init({ initial: 'de', detect: false });
        await w.setLocale('fr');
        slow.resolve({ hello: 'Hallo' });
        await ready;
        assert.equal(w.getLocale(), 'fr');
    });
});

describe('persistence', () => {
    async function app() {
        const w = await load();
        w.addDictionary('en', {});
        w.addDictionary('fr', {});
        w.addDictionary('ja', {});
        return w;
    }

    test('only explicit choices are stored, never the detected locale', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ja-JP'), localStorage: storage() }, async () => {
            await w.init({ persistKey: 'key' });
            assert.equal(w.getLocale(), 'ja');
            assert.equal(localStorage.data.key, undefined);

            await w.setLocale('fr');
            assert.equal(localStorage.data.key, 'fr');
            await w.setLocale('en');
            assert.equal(localStorage.data.key, 'en');
        });
    });

    test('explicitly choosing the detected locale stores it', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ja-JP'), localStorage: storage() }, async () => {
            await w.init({ persistKey: 'key' });
            await w.setLocale('ja');
            assert.equal(localStorage.data.key, 'ja');
        });
    });

    test('a locale that fails to load is not stored', async () => {
        const w = await app();
        w.registerLoader('de', async () => { throw new Error('offline'); });
        await withGlobals({ navigator: browser('en-US'), localStorage: storage() }, async () => {
            await w.init({ persistKey: 'key' });
            await captureConsole('error', () => w.setLocale('de'));
            assert.equal(localStorage.data.key, undefined);
        });
    });

    test('resetLocale forgets the choice and detects again without storing', async () => {
        const w = await app();
        await withGlobals({ navigator: browser('ja-JP'), localStorage: storage() }, async () => {
            await w.init({ persistKey: 'key' });
            await w.setLocale('fr');
            await w.resetLocale();
            assert.equal(w.getLocale(), 'ja');
            assert.equal(localStorage.data.key, undefined);

            await w.setLocale('en');
            assert.equal(localStorage.data.key, 'en');
        });
    });

    test('works when localStorage is unavailable or throws', async () => {
        const w = await app();
        const broken = {
            getItem() { throw new Error('denied'); },
            setItem() { throw new Error('denied'); },
            removeItem() { throw new Error('denied'); },
        };
        await withGlobals({ localStorage: broken }, async () => {
            await w.init({ persistKey: 'key', detect: false });
            assert.equal(await w.setLocale('fr'), true);
            await w.resetLocale();
            assert.equal(w.getLocale(), 'en');
        });
        await withGlobals({ localStorage: undefined }, async () => {
            await w.init({ persistKey: 'key', detect: false });
            assert.equal(await w.setLocale('fr'), true);
        });
    });
});

describe('detectLocale', () => {
    async function detect(known, languages, mapping) {
        const w = await load();
        for (const id of known) w.addDictionary(id, {});
        return withGlobals({ navigator: browser(...languages) }, () => w.detectLocale(mapping));
    }

    test('exact match, ignoring case', async () => {
        assert.equal(await detect(['en', 'ja-JP'], ['ja-jp']), 'ja-JP');
    });

    test('region falls back to the bare language', async () => {
        assert.equal(await detect(['en', 'ja'], ['ja-JP']), 'ja');
    });

    test('bare language or another region matches a regional locale', async () => {
        assert.equal(await detect(['en-US', 'pt-BR'], ['pt']), 'pt-BR');
        assert.equal(await detect(['en-US', 'pt-BR'], ['en-GB']), 'en-US');
    });

    test('never matches on a shared prefix of a different language', async () => {
        assert.equal(await detect(['fi', 'en'], ['fil-PH']), '');
        assert.equal(await detect(['es'], ['est']), '');
    });

    test('follows the order of browser preferences', async () => {
        assert.equal(await detect(['en', 'ja'], ['ko-KR', 'ja-JP', 'en-US']), 'ja');
        assert.equal(await detect(['en', 'ja'], ['en-US', 'ja-JP']), 'en');
    });

    test('prefers the most specific match for one language', async () => {
        assert.equal(await detect(['zh', 'zh-TW'], ['zh-TW']), 'zh-TW');
        assert.equal(await detect(['zh-TW', 'zh'], ['zh-CN']), 'zh');
        assert.equal(await detect(['zh', 'zh-Hant'], ['zh-Hant-TW']), 'zh-Hant');
        assert.equal(await detect(['zh-Hant', 'zh'], ['zh-Hans-CN']), 'zh');
    });

    test('aliases send extra language tags to one of your locales', async () => {
        const chinese = { 'zh-TW': 'zh-Hant', 'zh-HK': 'zh-Hant' };
        assert.equal(await detect(['zh-Hans', 'zh-Hant', 'en'], ['zh-TW'], chinese), 'zh-Hant');
        assert.equal(await detect(['zh-Hans', 'zh-Hant', 'en'], ['zh-HK', 'en'], chinese), 'zh-Hant');
        assert.equal(await detect([], ['ja-JP'], { ja: 'jp' }), 'jp');
        assert.equal(await detect([], ['ko-KR'], { ja: 'jp' }), '');
    });

    test('everything without an alias is still matched automatically', async () => {
        const chinese = { 'zh-TW': 'zh-Hant' };
        assert.equal(await detect(['zh-Hant', 'fr', 'en'], ['fr-CA'], chinese), 'fr');
        assert.equal(await detect(['zh-Hant', 'fr', 'en'], ['de', 'en-GB'], chinese), 'en');
    });

    test('returns an empty string without a navigator or without a match', async () => {
        const w = await load();
        w.addDictionary('en', {});
        assert.equal(await withGlobals({ navigator: undefined }, () => w.detectLocale()), '');
        assert.equal(await detect(['en'], ['ko-KR']), '');
        assert.equal(await withGlobals({ navigator: {} }, () => w.detectLocale()), '');
    });
});

describe('document', () => {
    test('keeps <html lang> and dir in step with the locale', async () => {
        const w = await load();
        w.addDictionary('en', {});
        w.addDictionary('ar-EG', {});
        const documentElement = {};
        await withGlobals({ document: { documentElement } }, async () => {
            await w.init({ detect: false });
            assert.deepEqual(documentElement, { lang: 'en', dir: 'ltr' });
            await w.setLocale('ar-EG');
            assert.deepEqual(documentElement, { lang: 'ar-EG', dir: 'rtl' });
        });
    });
});

describe('known locales', () => {
    test('getLocales lists loaders and dictionaries without duplicates', async () => {
        const w = await english();
        w.registerLoader('fr', async () => ({}));
        w.registerLoader('en', async () => ({}));
        assert.deepEqual(w.getLocales().sort(), ['en', 'fr']);
    });
});

describe('missing keys', () => {
    test('onMissing fires once per locale and key', async () => {
        const seen = [];
        const w = await english({ hello: 'Hello' }, { warn: undefined, onMissing: entry => seen.push(entry) });
        w.addDictionary('ja', {});
        w.t('nope');
        w.t('nope');
        await w.setLocale('ja');
        w.t('nope');
        assert.deepEqual(seen, [{ locale: 'en', key: 'nope' }, { locale: 'ja', key: 'nope' }]);
    });

    test('a key the fallback resolves is still reported for the active locale', async () => {
        const seen = [];
        const w = await english({ only: 'Only English' }, { onMissing: entry => seen.push(entry) });
        w.addDictionary('ja', {});
        await w.setLocale('ja');
        assert.equal(w.t('only'), 'Only English');
        assert.deepEqual(seen, [{ locale: 'ja', key: 'only' }]);
    });

    test('warns by default with a stable message', async () => {
        const w = await english({}, { warn: undefined });
        const warnings = await captureConsole('warn', () => { w.t('a.b'); w.t('a.b'); });
        assert.deepEqual(warnings, [['svelte-whisper: Missing "a.b" for locale "en"']]);
    });

    test('onMissing silences the warning unless warn is true', async () => {
        const quiet = await english({}, { warn: undefined, onMissing() { } });
        assert.equal((await captureConsole('warn', () => quiet.t('a'))).length, 0);
        const loud = await english({}, { warn: true, onMissing() { } });
        assert.equal((await captureConsole('warn', () => loud.t('a'))).length, 1);
    });

    test('warn: false is silent', async () => {
        const w = await english({}, { warn: false });
        assert.equal((await captureConsole('warn', () => w.t('a'))).length, 0);
    });

    test('nothing is reported before a locale is active', async () => {
        const w = await load();
        assert.equal((await captureConsole('warn', () => w.t('a'))).length, 0);
    });

    test('init starts a fresh report', async () => {
        const seen = [];
        const options = { detect: false, onMissing: entry => seen.push(entry) };
        const w = await english({}, options);
        w.t('a');
        await w.init(options);
        w.t('a');
        assert.equal(seen.length, 2);
    });
});

describe('formatting', () => {
    async function app() {
        const w = await english();
        w.addDictionary('de', {});
        w.addDictionary('fr', {});
        return w;
    }

    test('formatNumber follows the active locale and accepts Intl options', async () => {
        const w = await app();
        assert.equal(w.formatNumber(1234567.5), '1,234,567.5');
        assert.equal(w.formatNumber(1234.5, { style: 'currency', currency: 'USD' }), '$1,234.50');
        assert.equal(w.formatNumber(1500000, { notation: 'compact' }), '1.5M');
        await w.setLocale('de');
        assert.equal(w.formatNumber(1234567.5), '1.234.567,5');
    });

    test('an explicit locale overrides the active one', async () => {
        const w = await app();
        assert.equal(w.formatNumber(1234.5, undefined, 'de'), '1.234,5');
        assert.equal(w.formatNumber(1234.5, { minimumFractionDigits: 2 }, 'de'), '1.234,50');
    });

    test('percentages are a formatNumber style', async () => {
        const w = await app();
        const percent = (value, digits = 0) => w.formatNumber(value, { style: 'percent', maximumFractionDigits: digits });
        assert.equal(percent(0.2), '20%');
        assert.equal(percent(0.123, 1), '12.3%');
        await w.setLocale('fr');
        // French puts a non-breaking space before the sign; which one depends on the ICU version.
        assert.match(percent(0.2), /^20\s%$/);
    });

    test('formatDate follows the active locale and accepts Intl options', async () => {
        const w = await app();
        const date = new Date(Date.UTC(2026, 2, 5, 12));
        const options = { dateStyle: 'long', timeZone: 'UTC' };
        assert.equal(w.formatDate(date, options), 'March 5, 2026');
        assert.equal(w.formatDate(date.getTime(), options, 'fr'), '5 mars 2026');
        await w.setLocale('de');
        assert.equal(w.formatDate(date, options), '5. März 2026');
    });

    test('localeName gives a language its own name, or names it in another language', async () => {
        const w = await app();
        assert.equal(w.localeName('ja'), '日本語');
        assert.equal(w.localeName('fr'), 'français');
        assert.equal(w.localeName('ja', 'en'), 'Japanese');
        assert.equal(w.localeName('not_a_tag'), 'not_a_tag');
    });

    test('a locale id that is not a valid language tag formats with the default locale', async () => {
        const w = await app();
        w.addDictionary('not_a_tag', {});
        await w.setLocale('not_a_tag');
        assert.equal(typeof w.formatNumber(1234.5), 'string');
        assert.equal(typeof w.formatDate(0), 'string');
    });
});

describe('regressions', () => {
    test('a superseded init whose load then fails does not replace the newer locale', async () => {
        const w = await load();
        w.addDictionary('en', {});
        w.addDictionary('fr', {});
        const slow = deferred();
        w.registerLoader('de', () => slow.promise);
        const starting = w.init({ initial: 'de', detect: false, warn: false });
        await w.setLocale('fr');
        slow.resolve(null);
        await starting;
        assert.equal(w.getLocale(), 'fr');
    });

    test('a load that fails without awaiting anything can be retried', async () => {
        const w = await load();
        w.registerLoader('en', async () => ({}));
        assert.equal(await w.loadLocale('fr'), false);
        w.registerLoader('fr', async () => ({ hello: 'Bonjour' }));
        assert.equal(await w.loadLocale('fr'), true);

        let calls = 0;
        w.registerLoader('ja', () => {
            if (!calls++) throw new Error('sync failure');
            return Promise.resolve({ hello: 'こんにちは' });
        });
        await captureConsole('error', async () => assert.equal(await w.loadLocale('ja'), false));
        assert.equal(await w.loadLocale('ja'), true);
    });

    test('a loader result that is not a dictionary is refused, without rejecting', async () => {
        const w = await load();
        w.addDictionary('en', { hello: 'Hello' });
        await w.init({ detect: false, warn: false });
        w.registerLoader('text', async () => 'not a dictionary');
        const cyclic = {};
        cyclic.self = cyclic;
        w.registerLoader('loop', async () => cyclic);
        assert.equal(await w.setLocale('text'), false);
        await captureConsole('error', async () => assert.equal(await w.setLocale('loop'), false));
        assert.equal(w.getLocale(), 'en');
        assert.equal(w.t('0'), '0');
    });

    test('adding one plural form keeps the others', async () => {
        const w = await load();
        w.addDictionary('en', { items: { one: 'One', other: 'Many' } });
        await w.init({ detect: false, warn: false });
        w.addDictionary('en', { items: { one: 'Single' } });
        assert.equal(w.t('items', { count: 1 }), 'Single');
        assert.equal(w.t('items', { count: 2 }), 'Many');
    });

    test('an array stays an array when vars carry a count', async () => {
        const w = await load();
        w.addDictionary('en', { rules: ['A', 'B'], group: { a: 'A' } });
        await w.init({ detect: false, warn: false });
        assert.deepEqual(w.t('rules', { count: 1 }), ['A', 'B']);
        assert.deepEqual(w.t('group', { count: 1 }), { a: 'A' });
    });
});
