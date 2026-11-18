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

    test('always returns a string', async () => {
        const w = await english({ rules: ['One', 'Two'], nav: { home: 'Home' }, max: 5, on: true });
        assert.equal(w.t('rules.1'), 'Two');
        assert.equal(w.t('max'), '5');
        assert.equal(w.t('on'), 'true');
        assert.equal(w.t('max', { unused: 1 }), '5');
        // A list or a group is not a message: like any other missing key, it comes back as the key.
        assert.equal(w.t('rules'), 'rules');
        assert.equal(w.t('nav'), 'nav');
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
    test('named and indexed placeholders', async () => {
        const w = await english({
            named: 'Hello {user}!',
            indexed: '{1} before {0}',
            empty: 'Left {} alone',
            spaced: 'Hello { user }!',
            repeat: '{x}-{x}',
        });
        assert.equal(w.t('named', { user: 'Ada' }), 'Hello Ada!');
        assert.equal(w.t('indexed', ['a', 'b']), 'b before a');
        assert.equal(w.t('empty', ['a']), 'Left {} alone');
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

    test('uses other when the category has no entry, and when no count is given', async () => {
        const w = await english({ items: { one: 'one item', other: '{count} items' }, files: { other: '{count} files' } });
        assert.equal(w.t('files', { count: 1 }), '1 files');
        assert.equal(w.t('items'), '{count} items');
        assert.equal(w.t('items', { count: '1' }), '1 items', 'only a number selects a form');
        assert.equal(w.t('items.one'), 'one item');
    });

    test('a message wins over a plural group of the same name', async () => {
        const w = await english({ 'items': 'Items', 'items.other': 'ignored' });
        assert.equal(w.t('items', { count: 2 }), 'Items');
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
    test('a loader runs once, on first use', async () => {
        const w = await english({ hello: 'Hello' });
        let calls = 0;
        w.registerLoader('fr', async () => { calls++; return { hello: 'Bonjour' }; });
        assert.equal(calls, 0);
        assert.equal(await w.setLocale('fr'), true);
        await w.setLocale('en');
        await w.setLocale('fr');
        assert.equal(calls, 1);
        assert.equal(w.t('hello'), 'Bonjour');
    });

    test('a module is unwrapped; a dictionary with a "default" key is used as written', async () => {
        const w = await english();
        // What `import('./fr.json')` resolves to.
        const module = Object.defineProperty({ default: { hello: 'Bonjour' }, hello: 'Bonjour' }, Symbol.toStringTag, { value: 'Module' });
        w.registerLoader('fr', async () => module);
        w.registerLoader('de', async () => ({ default: { label: 'Standard' }, other: 'Andere' }));
        w.registerLoader('es', async () => ({ default: { label: 'Predeterminado' } }));
        w.registerLoader('it', async () => ({ default: 'Predefinito' }));

        await w.setLocale('fr');
        assert.equal(w.t('hello'), 'Bonjour');
        assert.equal(w.t('default.hello'), 'default.hello');
        await w.setLocale('de');
        assert.equal(w.t('default.label'), 'Standard');
        assert.equal(w.t('other'), 'Andere');
        await w.setLocale('es');
        assert.equal(w.t('default.label'), 'Predeterminado');
        await w.setLocale('it');
        assert.equal(w.t('default'), 'Predefinito');
    });

    test('registers a whole glob, naming locales after their files', async () => {
        const w = await english();
        w.registerLoader({
            './locales/fr.json': async () => ({ hello: 'Bonjour' }),
            '../i18n/pt-BR.json': async () => ({ hello: 'Olá' }),
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
    async function detect(known, languages) {
        const w = await load();
        for (const id of known) w.addDictionary(id, {});
        return withGlobals({ navigator: browser(...languages) }, () => w.detectLocale());
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

    test('matches the script a region implies, without configuration', async () => {
        const chinese = ['zh-Hans', 'zh-Hant', 'en'];
        assert.equal(await detect(chinese, ['zh-TW']), 'zh-Hant');
        assert.equal(await detect(chinese, ['zh-HK', 'en']), 'zh-Hant');
        assert.equal(await detect(chinese, ['zh-CN']), 'zh-Hans');
        assert.equal(await detect(chinese, ['zh']), 'zh-Hans');
        assert.equal(await detect(['sr-Latn', 'sr-Cyrl'], ['sr-ME']), 'sr-Latn');
    });

    test('a bare language picks its usual region', async () => {
        assert.equal(await detect(['pt-PT', 'pt-BR'], ['pt']), 'pt-BR');
        assert.equal(await detect(['en-GB', 'en-US'], ['en']), 'en-US');
        assert.equal(await detect(['en-US', 'en'], ['en']), 'en', 'an exact id still wins');
    });

    test('ignores locale ids that are not language tags', async () => {
        assert.equal(await detect(['not_a_tag', 'en'], ['en-US']), 'en');
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

    test('a list is never indexed by a count', async () => {
        const w = await load();
        w.addDictionary('en', { rules: ['A', 'B'], group: { a: 'A' } });
        await w.init({ detect: false, warn: false });
        assert.equal(w.t('rules', { count: 1 }), 'rules');
        assert.equal(w.t('group', { count: 1 }), 'group');
    });
});

describe('review round 2', () => {
    test('a newer choice survives a startup whose own load fails afterwards', async () => {
        const w = await load();
        let finish;
        w.registerLoader('en', () => new Promise(resolve => { finish = resolve; }));
        w.addDictionary('fr', {});
        const store = storage();
        await withGlobals({ localStorage: store }, async () => {
            const boot = w.init({ detect: false, persistKey: 'locale', warn: false });
            const newer = w.loadLocale('en').then(() => w.setLocale('fr'));
            finish(null);
            assert.equal(await newer, true);
            await boot;
            assert.equal(w.getLocale(), 'fr');
            assert.equal(store.data.locale, 'fr');
        });
    });

    test('translations added while a locale loads stay on top of the loaded file', async () => {
        const w = await load();
        const slow = deferred();
        w.registerLoader('en', () => slow.promise);
        const switching = w.setLocale('en');
        w.addDictionary('en', { key: 'added', extra: 'Extra' });
        slow.resolve({ key: 'loaded', other: 'Other' });
        await switching;
        assert.equal(w.t('key'), 'added');
        assert.equal(w.t('other'), 'Other');
        assert.equal(w.t('extra'), 'Extra');
    });

    test('a failed switch does not re-run readers, so an effect that keeps the locale in step cannot loop', async () => {
        const w = await english({ hello: 'Hello' });
        let loads = 0;
        w.registerLoader('it', async () => { loads++; return null; });
        const page = observe(() => {
            if (w.getLocale() !== 'it') w.setLocale('it'); // what a route-driven app does
            return w.getLocale();
        });
        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve));
            page.flush();
        }
        page.stop();
        assert.equal(loads, 1);
        assert.deepEqual(page.seen, ['en']);
    });

    test('the formatter cache is bounded', async () => {
        const w = await english();
        const Real = Intl.NumberFormat;
        let built = 0;
        Intl.NumberFormat = class extends Real { constructor(...args) { super(...args); built++; } };
        try {
            const price = i => w.formatNumber(1, { minimumIntegerDigits: 1 + i % 21, maximumFractionDigits: Math.floor(i / 21) });
            for (let i = 0; i < 420; i++) price(i);
            assert.equal(built, 420, 'each distinct set of options is built once');
            price(419);
            assert.equal(built, 420, 'and then reused');
            price(0);
            assert.equal(built, 421, 'the oldest ones were dropped when the cache filled up');
        } finally {
            Intl.NumberFormat = Real;
        }
    });

    test('text direction follows the script, not a list of languages', async () => {
        const w = await load();
        for (const id of ['en', 'ar', 'he', 'fa', 'ur', 'az-Arab', 'ar-Latn', 'not_a_tag']) w.addDictionary(id, {});
        const documentElement = {};
        await withGlobals({ document: { documentElement } }, async () => {
            await w.init({ detect: false });
            const seen = {};
            for (const id of ['ar', 'he', 'fa', 'ur', 'az-Arab', 'ar-Latn', 'not_a_tag', 'en']) {
                await w.setLocale(id);
                seen[id] = documentElement.dir;
            }
            assert.deepEqual(seen, { ar: 'rtl', he: 'rtl', fa: 'rtl', ur: 'rtl', 'az-Arab': 'rtl', 'ar-Latn': 'ltr', not_a_tag: 'ltr', en: 'ltr' });
        });
    });
});

describe('review round 3', () => {
    test('a locale with a loader is not ready until the loader has delivered', async () => {
        const w = await english({ hello: 'Hello' });
        let attempts = 0;
        w.registerLoader('fr', async () => {
            if (++attempts === 1) throw new Error('offline');
            return { hello: 'Bonjour', bye: 'Au revoir' };
        });
        w.addDictionary('fr', { hello: 'Salut' }); // an override, added before the file is in
        await captureConsole('error', async () => assert.equal(await w.setLocale('fr'), false));
        assert.equal(w.getLocale(), 'en', 'the override alone does not make the locale usable');
        assert.equal(await w.setLocale('fr'), true, 'and the failed load is retried');
        assert.equal(attempts, 2);
        assert.equal(w.t('hello'), 'Salut');
        assert.equal(w.t('bye'), 'Au revoir');
    });

    test('a switch made while the same locale is loading waits for it', async () => {
        const w = await english({ hello: 'Hello' });
        const slow = deferred();
        w.registerLoader('fr', () => slow.promise);
        const first = w.setLocale('fr');
        w.addDictionary('fr', { extra: 'Extra' });
        const second = w.setLocale('fr');
        assert.equal(w.getLocale(), 'en');
        slow.resolve({ hello: 'Bonjour' });
        assert.deepEqual(await Promise.all([first, second]), [false, true]);
        assert.equal(w.t('hello'), 'Bonjour');
    });

    test('without a loader, having a dictionary is enough', async () => {
        const w = await english();
        w.addDictionary('fr', { hello: 'Bonjour' });
        w.registerLoader('ja', async () => ({}));
        assert.equal(await w.setLocale('fr'), true);
    });

    test('a locale without a region beats one from another region', async () => {
        const detect = async (known, languages) => {
            const lib = await load();
            for (const id of known) lib.addDictionary(id, {});
            return withGlobals({ navigator: browser(...languages) }, () => lib.detectLocale());
        };
        assert.equal(await detect(['en-US', 'en'], ['en-GB']), 'en');
        assert.equal(await detect(['en', 'en-US'], ['en-GB']), 'en');
        assert.equal(await detect(['es-ES', 'es'], ['es-MX']), 'es');
        assert.equal(await detect(['en-US', 'en-GB'], ['en-AU']), 'en-US', 'with only regions on offer, the first one');
        assert.equal(await detect(['zh-Hant-TW', 'zh-Hant'], ['zh-HK']), 'zh-Hant');
    });

    test('placeholders only read the values that were passed', async () => {
        const w = await english({ a: '{constructor} {toString} {name}', b: 'Tag {tag}' });
        assert.equal(w.t('a', { name: 'Ada' }), '{constructor} {toString} Ada');
        assert.equal(w.t('b', { tag: Symbol('x') }), 'Tag Symbol(x)');
        assert.equal(w.t('a', ['zero']), '{constructor} {toString} {name}');
    });

    test('the overlay hears about a missing key even when the app\'s own hook throws', async () => {
        const w = await english({}, { onMissing() { throw new Error('boom'); } });
        assert.throws(() => w.t('nope'), /boom/);
        assert.equal(w.t('nope'), 'nope', 'and it is reported once');
    });
});

describe('stores, for components without runes', () => {
    test('t and locale follow the Svelte store contract', async () => {
        const { get } = await import('svelte/store');
        const w = await english({ hello: 'Hello' });
        w.addDictionary('fr', { hello: 'Bonjour' });

        assert.equal(get(w.locale), 'en');
        assert.equal(get(w.t)('hello'), 'Hello');

        const locales = [];
        const texts = [];
        const stopLocale = w.locale.subscribe(value => locales.push(value));
        const stopT = w.t.subscribe(translate => texts.push(translate('hello')));
        assert.equal(await w.locale.set('fr'), true);
        w.addDictionary('fr', { hello: 'Salut' });
        stopLocale();
        stopT();
        await w.setLocale('en');

        assert.deepEqual(texts, ['Hello', 'Bonjour', 'Salut'], 'called at once, then on every change, never after unsubscribing');
        assert.deepEqual([...new Set(locales)], ['en', 'fr']);
        assert.equal(w.getLocale(), 'en');
    });

    test('the store value is t itself, so $t(key) and t(key) are the same call', async () => {
        const w = await english({ hello: 'Hello' });
        let seen;
        w.t.subscribe(value => { seen = value; })();
        assert.equal(seen, w.t);
    });
});

describe('formatPercent', () => {
    test('formats a fraction as a percentage in the active or a given locale', async () => {
        const w = await english();
        w.addDictionary('fr', {});
        assert.equal(w.formatPercent(0), '0%');
        assert.equal(w.formatPercent(0.2), '20%');
        assert.equal(w.formatPercent(0.256), '26%');
        assert.equal(w.formatPercent(0.256, 1), '25.6%');
        assert.equal(w.formatPercent(0.5, 2), '50%');
        assert.equal(w.formatPercent(12.345, 1), '1,234.5%');
        assert.match(w.formatPercent(0.2, 0, 'fr'), /^20\s%$/);
        await w.setLocale('fr');
        assert.match(w.formatPercent(0.256, 1), /^25,6\s%$/);
    });
});

describe('review round 4', () => {
    test('a locale that every startup candidate names is tried once', async () => {
        const w = await load();
        let attempts = 0;
        w.registerLoader('en', async () => { attempts++; throw new Error('offline'); });
        w.addDictionary('en', { hello: 'Hello' });
        await withGlobals({ navigator: browser('en'), localStorage: storage({ key: 'en' }) }, async () => {
            await captureConsole('error', () => w.init({ persistKey: 'key', initial: 'en', fallback: 'en', warn: false }));
        });
        assert.equal(attempts, 1);
        assert.equal(w.getLocale(), 'en');
        assert.equal(w.t('hello'), 'Hello');
    });

    test('a loader that returns a list is refused and can be retried', async () => {
        const w = await english();
        let attempts = 0;
        w.registerLoader('fr', async () => (++attempts === 1 ? [] : { full: 'Complet' }));
        assert.equal(await w.setLocale('fr'), false);
        assert.equal(await w.setLocale('fr'), true);
        assert.equal(w.t('full'), 'Complet');
    });

    test('a loader registered for a locale that was fetched by convention still runs', async () => {
        const w = await load();
        const fetch = async () => ({ ok: true, json: async () => ({ fetched: 'Fetched' }) });
        await withGlobals({ fetch }, () => w.setLocale('fr'));
        w.registerLoader('fr', async () => ({ bundled: 'Bundled' }));
        assert.equal(await w.loadLocale('fr'), true);
        assert.equal(w.t('bundled'), 'Bundled');
        assert.equal(w.t('fetched'), 'Fetched');
    });

    test('regions are compared as written, whatever else the id carries', async () => {
        const detect = async (known, languages) => {
            const lib = await load();
            for (const id of known) lib.addDictionary(id, {});
            return withGlobals({ navigator: browser(...languages) }, () => lib.detectLocale());
        };
        assert.equal(await detect(['en-US-posix', 'en'], ['en-AU']), 'en');
        assert.equal(await detect(['en-US-u-nu-latn', 'en'], ['en-AU']), 'en');
        assert.equal(await detect(['zh-Hant', 'zh-Hant-TW'], ['zh-TW']), 'zh-Hant-TW');
        assert.equal(await detect(['en-x-us', 'en-GB'], ['en-AU']), 'en-x-us', 'a private-use tag has no region');
        assert.equal(await detect(['es-419', 'es'], ['es-MX']), 'es');
    });
});
