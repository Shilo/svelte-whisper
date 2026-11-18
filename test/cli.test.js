import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { main, flatten } from '../bin/svelte-whisper.js';

/** A throwaway project: `{ 'src/locales/en.json': {...}, 'src/App.svelte': '...' }`. */
function project(files, t) {
    const cwd = mkdtempSync(join(tmpdir(), 'whisper-cli-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(cwd, path)), { recursive: true });
        writeFileSync(join(cwd, path), typeof content === 'string' ? content : JSON.stringify(content, null, 4) + '\n');
    }
    return {
        cwd,
        run: (...argv) => main(argv, cwd),
        json: (...argv) => JSON.parse(main([...argv, '--json'], cwd).out),
        read: path => readFileSync(join(cwd, path), 'utf8'),
    };
}

const en = {
    hello: 'Hello {name}!',
    nav: { home: 'Home', about: 'About' },
    items: { one: '{count} item', other: '{count} items' },
    rules: ['First', 'Second'],
    brand: 'GitHub',
};

describe('flatten', () => {
    test('keeps a plural object as one leaf and indexes arrays', () => {
        assert.deepEqual([...flatten(en).keys()], ['hello', 'nav.home', 'nav.about', 'items', 'rules.0', 'rules.1', 'brand']);
    });
});

describe('check', () => {
    test('passes when every locale mirrors the source', t => {
        const p = project({
            'src/locales/en.json': en,
            'src/locales/fr.json': {
                hello: 'Bonjour {name} !',
                nav: { home: 'Accueil', about: 'À propos' },
                items: { one: '{count} article', many: '{count} articles', other: '{count} articles' },
                rules: ['Premier', 'Deuxième'],
                brand: 'GitHub',
            },
        }, t);
        const result = p.run('check');
        assert.equal(result.code, 0);
        assert.match(result.out, /✔ fr: 0 missing, 0 extra, 0 placeholder mismatches, 1 identical/);
        assert.deepEqual(p.json('check').locales.fr.identical, ['brand']);
    });

    test('reports missing keys, extra keys and placeholder mismatches, and exits 1', t => {
        const p = project({
            'src/locales/en.json': en,
            'src/locales/es.json': {
                hello: '¡Hola {nombre}!',
                nav: { home: 'Inicio', old: 'Viejo' },
                items: { one: '{count} artículo', other: 'artículos' },
                rules: ['Primero', 'Segundo'],
                brand: 'GitHub',
            },
        }, t);
        assert.equal(p.run('check').code, 1);
        const { es } = p.json('check').locales;
        assert.deepEqual(es.missing, ['nav.about']);
        assert.deepEqual(es.extra, ['nav.old']);
        assert.deepEqual(es.placeholders, [{ key: 'hello', source: ['{name}'], es: ['{nombre}'] }]);
    });

    test('a plural may add or drop categories but must keep its placeholders', t => {
        const p = project({
            'src/locales/en.json': { items: en.items },
            'src/locales/ja.json': { items: { other: '{count}個' } },
            'src/locales/ru.json': { items: { one: '{count} файл', few: 'файла', many: 'файлов', other: 'файла' } },
        }, t);
        assert.equal(p.run('check').code, 0);
    });

    test('scans code for unused and undefined keys', t => {
        const p = project({
            'src/locales/en.json': { ...en, skills: { fire: 'Fire', ice: 'Ice' }, orphan: 'Orphan' },
            'src/App.svelte': [
                `<h1>{t('hello', { name })}</h1>`,
                `<p>{t("nav.typo")}</p>`,
                `<p>{t(\`skills.\${id}\`)}</p>`,
                `<p>{t('items', { count })} {t('rules.0')} {format('not.a.key')} {obj.t('nor.this')}</p>`,
            ].join('\n'),
            'src/menu.js': `export const menu = [{ label: 'nav.home' }, { label: "nav.about" }, 'brand', 'rules.1'];`,
            'src/node_modules/x/index.js': `t('orphan')`,
        }, t);
        const report = p.json('check', '--usage', 'src');
        assert.deepEqual(report.unused, ['orphan']);
        assert.deepEqual(report.undefined, [{ key: 'nav.typo', file: report.undefined[0].file, line: 2 }]);
        assert.match(report.undefined[0].file, /App\.svelte$/);
        assert.deepEqual(report.dynamic, ['skills.*']);
    });

    test('reads the folder and source locale from package.json', t => {
        const p = project({
            'package.json': { 'svelte-whisper': { locales: 'i18n', source: 'de' } },
            'i18n/de.json': { hallo: 'Hallo' },
            'i18n/en.json': { hallo: 'Hello' },
        }, t);
        assert.match(p.run('check').out, /Source "de": 1 keys\n\n✔ en/);
    });

    test('explains how to point at the locales when none are found', t => {
        const p = project({ 'README.md': '' }, t);
        assert.throws(() => p.run('check'), /Source locale not found: src.locales.en\.json/);
    });
});

describe('apply', () => {
    test('merges translations, drops stale keys and follows source order and indentation', t => {
        const p = project({
            'src/locales/en.json': en,
            'src/locales/fr.json': { brand: 'GitHub', gone: 'Disparu', nav: { home: 'Accueil' } },
            'new.json': { hello: 'Bonjour {name} !', nav: { about: 'À propos' }, 'rules.0': 'Premier' },
        }, t);
        const result = p.json('apply', 'fr', 'new.json');
        assert.deepEqual(result.fr, { applied: 3, kept: 2, glossary: 0, removed: ['gone'], missing: ['items', 'rules.1'] });
        assert.equal(p.read('src/locales/fr.json'), JSON.stringify({
            hello: 'Bonjour {name} !',
            nav: { home: 'Accueil', about: 'À propos' },
            rules: ['Premier'],
            brand: 'GitHub',
        }, null, 4) + '\n');
    });

    test('creates a new locale from scratch', t => {
        const p = project({
            'src/locales/en.json': { a: 'A', b: { c: 'C' } },
            'de.json': { a: 'Ä', b: { c: 'Z' } },
        }, t);
        p.run('apply', 'de', 'de.json');
        assert.deepEqual(JSON.parse(p.read('src/locales/de.json')), { a: 'Ä', b: { c: 'Z' } });
        assert.equal(p.run('check').code, 0);
    });

    test('refuses keys that are not in the source, and refuses the source locale', t => {
        const p = project({ 'src/locales/en.json': { a: 'A' }, 'x.json': { zzz: 'nope' } }, t);
        assert.throws(() => p.run('apply', 'fr', 'x.json'), /Not in the source locale.*zzz/);
        assert.throws(() => p.run('apply', 'en', 'x.json'), /is the source locale/);
    });
});

describe('sync and glossary', () => {
    test('sync prunes stale keys and reorders every locale without translating', t => {
        const p = project({
            'src/locales/en.json': { a: 'A', b: 'B' },
            'src/locales/fr.json': { old: 'Vieux', b: 'B fr', a: 'A fr' },
            'src/locales/ja.json': { b: 'B ja' },
        }, t);
        const result = p.json('sync');
        assert.deepEqual(result.fr.removed, ['old']);
        assert.deepEqual(result.ja.missing, ['a']);
        assert.equal(p.read('src/locales/fr.json'), JSON.stringify({ a: 'A fr', b: 'B fr' }, null, 4) + '\n');
    });

    test('glossary terms win over new and existing translations, and check enforces them', t => {
        const p = project({
            'src/locales/en.json': { skills: { attack: 'Attack Boost', guard: 'Guard' }, title: 'Skills' },
            'src/locales/ja.json': { skills: { attack: '攻撃ブースト', guard: 'ガード' }, title: 'スキル' },
            'src/locales/glossary/ja.json': { skills: { attack: '攻撃力強化' } },
            'new.json': { 'skills.attack': 'アタックブースト', title: 'スキル一覧' },
        }, t);
        assert.equal(p.run('check').code, 1);
        assert.deepEqual(p.json('check').locales.ja.glossary, ['skills.attack']);

        assert.deepEqual(p.json('apply', 'ja', 'new.json').ja, { applied: 1, kept: 1, glossary: 1, removed: [], missing: [] });
        assert.deepEqual(JSON.parse(p.read('src/locales/ja.json')), {
            skills: { attack: '攻撃力強化', guard: 'ガード' },
            title: 'スキル一覧',
        });
        assert.equal(p.run('check').code, 0);
    });

    test('a glossary term identical to the source is not flagged as untranslated', t => {
        const p = project({
            'src/locales/en.json': { brand: 'Backpack Planner', other: 'Other words' },
            'src/locales/fr.json': { brand: 'Backpack Planner', other: 'Other words' },
            'src/locales/glossary/fr.json': { brand: 'Backpack Planner' },
        }, t);
        assert.deepEqual(p.json('check').locales.fr.identical, ['other']);
    });
});

describe('diff', () => {
    test('lists source keys added, changed and removed since a commit', t => {
        const p = project({ 'src/locales/en.json': { keep: 'Keep', change: 'Old', remove: 'Bye' } }, t);
        const git = (...args) => execFileSync('git', args, { cwd: p.cwd, stdio: 'ignore' });
        git('init', '-q');
        git('add', '-A');
        git('-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'first');
        writeFileSync(join(p.cwd, 'src/locales/en.json'), JSON.stringify({ keep: 'Keep', change: 'New', add: 'Hi' }));
        assert.deepEqual(p.json('diff', '--since', 'HEAD'), {
            since: 'HEAD', added: ['add'], changed: ['change'], removed: ['remove'],
        });
        assert.throws(() => p.run('diff'), /needs --since/);
    });
});

describe('cli', () => {
    test('prints help and rejects unknown commands', t => {
        const p = project({ 'src/locales/en.json': {} }, t);
        assert.match(main(['--help']).out, /svelte-whisper — locale tools/);
        assert.equal(main([]).code, 1);
        assert.throws(() => p.run('nope'), /Unknown command "nope"/);
        assert.equal(p.run('keys').code, 0);
    });

    test('runs as an executable', t => {
        const p = project({ 'src/locales/en.json': { a: 'A' }, 'src/locales/fr.json': {} }, t);
        const bin = join(import.meta.dirname, '../bin/svelte-whisper.js');
        assert.throws(
            () => execFileSync(process.execPath, [bin, 'check'], { cwd: p.cwd, encoding: 'utf8', stdio: 'pipe' }),
            error => error.status === 1 && /✖ fr: 1 missing/.test(error.stdout),
        );
    });
});

describe('damage limits', () => {
    test('a locale file that is not a JSON object stops the run before anything is written', t => {
        const p = project({ 'src/locales/en.json': '"oops"', 'src/locales/fr.json': { hello: 'Bonjour' } }, t);
        assert.throws(() => p.run('sync'), /must contain a JSON object/);
        assert.throws(() => p.run('check'), /must contain a JSON object/);
        assert.deepEqual(JSON.parse(p.read('src/locales/fr.json')), { hello: 'Bonjour' });

        const q = project({
            'src/locales/en.json': { a: 'A' },
            'src/locales/de.json': { a: 'Ä', old: 'Alt' },
            'src/locales/fr.json': '[1, 2]',
            'bad.json': '"text"',
        }, t);
        assert.throws(() => q.run('sync'), /fr\.json: a locale file must contain a JSON object/);
        assert.deepEqual(JSON.parse(q.read('src/locales/de.json')), { a: 'Ä', old: 'Alt' }, 'de was not rewritten');
        assert.throws(() => q.run('apply', 'de', 'bad.json'), /must contain a JSON object/);
    });

    test('keys named __proto__ survive a rewrite', t => {
        const p = project({
            'src/locales/en.json': '{"__proto__":{"title":"Title"},"ok":"OK"}',
            'src/locales/fr.json': '{"ok":"Bien","__proto__":{"title":"Titre"}}',
        }, t);
        assert.equal(p.json('sync').fr.kept, 2);
        assert.equal(p.read('src/locales/fr.json').replace(/\s/g, ''), '{"__proto__":{"title":"Titre"},"ok":"Bien"}');
    });

    test('a message defined both nested and as a dotted key is refused, not merged', t => {
        const p = project({
            'src/locales/en.json': { a: { b: 'Nested' }, 'a.b': 'Literal' },
            'src/locales/fr.json': { a: { b: 'Imbriqué' }, 'a.b': 'Littéral' },
        }, t);
        assert.throws(() => p.run('sync'), /"a\.b" is defined twice/);
        assert.deepEqual(JSON.parse(p.read('src/locales/fr.json')), { a: { b: 'Imbriqué' }, 'a.b': 'Littéral' });
    });

    test('literal dotted keys and empty arrays are kept as they are', t => {
        const p = project({
            'src/locales/en.json': { 'errors.network': 'Offline', items: [], nav: { home: 'Home' } },
            'src/locales/fr.json': { nav: { home: 'Accueil' }, items: [], 'errors.network': 'Hors ligne' },
        }, t);
        assert.equal(p.run('check').code, 0);
        p.run('sync');
        assert.equal(p.read('src/locales/fr.json'), JSON.stringify({ 'errors.network': 'Hors ligne', items: [], nav: { home: 'Accueil' } }, null, 4) + '\n');
    });

    test('repeated placeholders count once and empty braces are plain text', t => {
        const p = project({
            'src/locales/en.json': { twice: '{name} is {name}', braces: 'An empty object is {}', pair: '{0} and {1}' },
            'src/locales/fr.json': { twice: '{name}', braces: 'Un objet vide', pair: '{1} et {0}' },
        }, t);
        assert.equal(p.run('check').code, 0);
    });
});

describe('review round 1', () => {
    test('code that uses a key no file has fails the check', t => {
        const p = project({
            'src/locales/en.json': { hello: 'Hello' },
            'src/locales/fr.json': { hello: 'Bonjour' },
            'src/App.svelte': `<p>{t('hello')} {t('nope')}</p>`,
        }, t);
        assert.equal(p.run('check').code, 0);
        assert.equal(p.run('check', '--usage', 'src').code, 1);
    });

    test('placeholder mismatches are printed without doubled braces', t => {
        const p = project({
            'src/locales/en.json': { hello: 'Hello {name}' },
            'src/locales/fr.json': { hello: 'Bonjour {nom}' },
        }, t);
        assert.match(p.run('check').out, /hello {2}source \{name\} ≠ fr \{nom\}/);
    });

    test('a missing apply input is reported, not thrown as a stack trace', t => {
        const p = project({ 'src/locales/en.json': { a: 'A' } }, t);
        assert.throws(() => p.run('apply', 'fr', 'nope.json'), error => error.constructor.name === 'UsageError' && /nope\.json/.test(error.message));
    });

    test('an empty source never erases the translations', t => {
        const p = project({ 'src/locales/en.json': {}, 'src/locales/fr.json': { a: 'A' } }, t);
        assert.throws(() => p.run('sync'), /en\.json has no keys/);
        assert.throws(() => p.run('apply', 'fr', 'src/locales/en.json'), /en\.json has no keys/);
        assert.deepEqual(JSON.parse(p.read('src/locales/fr.json')), { a: 'A' });
    });

    test('a byte order mark is tolerated and line endings are kept', t => {
        const p = project({
            'src/locales/en.json': '\uFEFF{\r\n    "a": "A",\r\n    "b": "B"\r\n}\r\n',
            'src/locales/fr.json': '{\r\n    "b": "B fr",\r\n    "a": "A fr"\r\n}\r\n',
            'src/locales/de.json': '{\n    "b": "B de",\n    "a": "A de"\n}\n',
        }, t);
        assert.equal(p.run('check').code, 0);
        p.run('sync');
        assert.equal(p.read('src/locales/fr.json'), '{\r\n    "a": "A fr",\r\n    "b": "B fr"\r\n}\r\n');
        assert.equal(p.read('src/locales/de.json'), '{\n    "a": "A de",\n    "b": "B de"\n}\n');
    });
});
