import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flushSync } from 'svelte';
import { LocaleDoc, makeDoc, output } from './helpers.js';

/** Save a draft the way the app does (through JSON) and restore it on a freshly loaded copy. */
function reload(files, doc) {
	const draft = JSON.parse(JSON.stringify(doc.toDraft()));
	const next = makeDoc(files);
	next.applyDraft(draft);
	return next;
}

const sample = () => ({
	en: { app: { title: 'Fieldnotes', tagline: 'Notes' }, greeting: 'Hi {name}' },
	fr: { app: { title: 'Fieldnotes', tagline: 'Notes FR' }, greeting: 'Salut {name}' }
});

test('a renamed key survives a draft round trip, with text typed under its new name', () => {
	const files = sample();
	const doc = makeDoc(files);
	doc.renameKey('app.title', 'app.name');
	doc.set('fr', 'app.name', 'Carnets');
	const count = doc.changeCount();

	const next = reload(files, doc);
	assert.ok(next.keys.includes('app.name'));
	assert.ok(!next.keys.includes('app.title'));
	assert.equal(next.renamed['app.name'], 'app.title');
	assert.equal(next.get('en', 'app.name'), 'Fieldnotes');
	assert.equal(next.get('fr', 'app.name'), 'Carnets');
	assert.equal(next.changeCount(), count);
	assert.deepEqual(JSON.parse(output(next, 'en')).app, { name: 'Fieldnotes', tagline: 'Notes' });
});

test('a translation cleared under a new name stays cleared after a reload', () => {
	const files = sample();
	const doc = makeDoc(files);
	doc.renameKey('app.title', 'app.name');
	doc.set('fr', 'app.name', '');
	const next = reload(files, doc);
	assert.equal(next.get('fr', 'app.name'), '');
	assert.equal(next.get('en', 'app.name'), 'Fieldnotes');
});

test('added, deleted and edited keys survive a draft round trip', () => {
	const files = sample();
	const doc = makeDoc(files);
	doc.addKey('app.extra');
	doc.set('en', 'app.extra', 'More');
	doc.deleteKey('greeting');
	doc.set('fr', 'app.tagline', 'Des notes');
	const next = reload(files, doc);
	assert.equal(next.get('en', 'app.extra'), 'More');
	assert.ok(next.isNewKey('app.extra'));
	assert.ok(next.deleted.greeting);
	assert.equal(next.get('fr', 'app.tagline'), 'Des notes');
	assert.equal(next.changeCount(), doc.changeCount());
});

test('null values are untranslated: editable, counted as missing, written in place', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: null, b: 'Bé' } });
	flushSync();
	assert.ok(!doc.isFixed('fr', 'a'));
	assert.ok(doc.isMissing('fr', 'a'));
	assert.equal(doc.missingCount('fr'), 1);
	assert.equal(output(doc, 'fr'), undefined); // nothing changed, nothing sent
	doc.set('fr', 'a', 'Ah');
	assert.equal(output(doc, 'fr'), '{\n\t"a": "Ah",\n\t"b": "Bé"\n}\n');
});

test('a key that is null everywhere is listed, and deleting it removes the nulls', () => {
	const doc = makeDoc({ en: { a: 'A', todo: null }, fr: { a: 'A', todo: null } });
	assert.ok(doc.keys.includes('todo'));
	assert.ok(!doc.isNewKey('todo'));
	doc.deleteKey('todo');
	assert.deepEqual(JSON.parse(output(doc, 'fr')), { a: 'A' });
});

test('keys with non-string values cannot be renamed or deleted', () => {
	const doc = makeDoc({ en: { list: ['a', 'b'], n: 3, s: 'x' } });
	assert.ok(doc.isFixedKey('list'));
	doc.deleteKey('list');
	doc.renameKey('n', 'm');
	assert.ok(!doc.deleted.list);
	assert.ok(doc.keys.includes('n'));
	assert.equal(doc.changeCount(), 0);
});

test('plural categories other than `other` are optional once `other` is there', () => {
	const doc = makeDoc({
		en: { items: { one: '{count} item', other: '{count} items' } },
		ru: { items: { one: '{count} предмет', few: '{count} предмета', other: '{count} предметов' } },
		ja: { items: { other: '{count} 件' } },
		de: {}
	});
	flushSync();
	assert.ok(doc.isOptional('ja', 'items.one'));
	assert.ok(doc.isOptional('en', 'items.few'));
	assert.ok(!doc.isMissing('ja', 'items.one'));
	assert.equal(doc.missingCount('ja'), 0);
	assert.ok(doc.isMissing('de', 'items.other'));
	assert.ok(doc.isMissing('de', 'items.one')); // no `other` yet, so every form is needed
	// A category the source does not have is checked against the source's `other`.
	assert.equal(doc.get('ru', 'items.few'), '{count} предмета');
	assert.equal(doc.warning('ru', 'items.few'), null);
	doc.set('ru', 'items.many', 'предметов');
	assert.equal(doc.get('ru', 'items.many'), 'предметов');
	assert.deepEqual(doc.warning('ru', 'items.many'), { missing: ['count'], extra: [] });
	doc.set('ru', 'items.few', '{n} предмета');
	assert.deepEqual(doc.warning('ru', 'items.few'), { missing: ['count'], extra: ['n'] });
});

test('placeholder warnings for {name} and {0}, none for {}', () => {
	const doc = makeDoc({
		en: { greet: 'Hi {name}', count: '{0} of {1}', braces: 'Use {} here' },
		fr: { greet: 'Salut {nom}', count: '{0} sur', braces: 'Utilisez {} ici' }
	});
	assert.deepEqual(doc.warning('fr', 'greet'), { missing: ['name'], extra: ['nom'] });
	assert.deepEqual(doc.warning('fr', 'count'), { missing: ['1'], extra: [] });
	assert.equal(doc.warning('fr', 'braces'), null);
	assert.equal(doc.warning('en', 'greet'), null);
});

test('a new key lands in source order in the other files', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B', c: 'C' }, fr: { a: 'A', c: 'C' } });
	doc.set('fr', 'b', 'Bé');
	assert.deepEqual(Object.keys(JSON.parse(output(doc, 'fr'))), ['a', 'b', 'c']);
});

test('an unchanged file is not sent, and an edited file keeps CRLF and its indentation', () => {
	const doc = makeDoc({ en: '{\r\n  "a": "A",\r\n  "b": "B"\r\n}\r\n', fr: '{"a":"A"}' });
	assert.deepEqual(doc.outputFiles(), []);
	doc.set('en', 'b', 'Bee');
	assert.equal(output(doc, 'en'), '{\r\n  "a": "A",\r\n  "b": "Bee"\r\n}\r\n');
});

test('a rename followed by an edit and a clear survives a draft reload', () => {
	const files = { en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' }, de: { a: 'Ach', b: 'Be' } };
	const doc = makeDoc(files);
	doc.renameKey('a', 'c');
	doc.set('fr', 'c', 'Cé');
	doc.set('de', 'c', '');
	const next = reload(files, doc);
	assert.equal(next.get('en', 'c'), 'A');
	assert.equal(next.get('fr', 'c'), 'Cé');
	assert.equal(next.get('de', 'c'), '');
	for (const lang of ['en', 'fr', 'de']) assert.equal(output(next, lang), output(doc, lang), lang);
	assert.deepEqual(JSON.parse(output(next, 'de')), { b: 'Be' });
});

test('an added language survives a draft reload', () => {
	const files = sample();
	const doc = makeDoc(files);
	doc.addLanguage('de');
	doc.set('de', 'greeting', 'Hallo {name}');
	const next = reload(files, doc);
	assert.deepEqual(next.langs, ['en', 'fr', 'de']);
	assert.equal(next.get('de', 'greeting'), 'Hallo {name}');
	const de = next.outputFiles().find((f) => f.lang === 'de');
	assert.ok(de?.isNew);
	assert.equal(de.path, 'src/locales/de.json');
	assert.deepEqual(JSON.parse(de.text), { greeting: 'Hallo {name}' });
});

test('a renamed key that is null in one file keeps its null under the new name', () => {
	const files = { en: { a: 'A', b: 'B' }, fr: { a: null, b: 'Bé' } };
	const doc = makeDoc(files);
	doc.renameKey('a', 'c');
	assert.equal(output(doc, 'fr'), '{\n\t"c": null,\n\t"b": "Bé"\n}\n'); // in the renamed row's place
	assert.equal(output(reload(files, doc), 'fr'), output(doc, 'fr'));
	// Text typed under the new name replaces the null.
	doc.set('fr', 'c', 'Cé');
	assert.deepEqual(JSON.parse(output(doc, 'fr')), { b: 'Bé', c: 'Cé' });
	// A deleted key loses its null.
	doc.set('fr', 'c', '');
	doc.deleteKey('c');
	assert.deepEqual(JSON.parse(output(doc, 'fr')), { b: 'Bé' });
});

test('changing the source language re-evaluates the warnings', () => {
	const doc = makeDoc({ en: { greet: 'Hi {name}' }, fr: { greet: 'Salut {nom}' } });
	assert.deepEqual(doc.warning('fr', 'greet'), { missing: ['name'], extra: ['nom'] });
	assert.equal(doc.warning('en', 'greet'), null);
	doc.setSource('fr');
	flushSync();
	assert.equal(doc.warning('fr', 'greet'), null);
	assert.deepEqual(doc.warning('en', 'greet'), { missing: ['nom'], extra: ['name'] });
});

test('validateKey accepts new keys and explains what is wrong with the rest', () => {
	const doc = makeDoc({ en: { app: { title: 'T' }, greeting: 'Hi' } });
	assert.equal(doc.validateKey('app.subtitle'), null);
	assert.equal(doc.validateKey('greeting', 'greeting'), null); // renaming to itself
	assert.equal(doc.validateKey('  '), 'Enter a key.');
	assert.equal(doc.validateKey('a b'), 'Keys cannot contain spaces.');
	for (const key of ['.a', 'a.', 'a..b']) assert.match(doc.validateKey(key) ?? '', /segment cannot be empty/, key);
	assert.equal(doc.validateKey('greeting'), 'That key already exists.');
	assert.match(doc.validateKey('app') ?? '', /Conflicts with “app.title”/);
	assert.match(doc.validateKey('greeting.formal') ?? '', /Conflicts with “greeting”/);
});

test('a file that defines a key both nested and dotted is refused', () => {
	assert.throws(() => makeDoc({ en: { a: { b: 'x' } }, fr: '{"a.b":"literal","a":{"b":"nested"}}' }), {
		message: 'fr.json defines a.b twice, once nested and once as a dotted key. Fix it in the repository first.'
	});
});

test('a name that is a group in one file is read-only there, so typing cannot replace the group', () => {
	const doc = new LocaleDoc(
		[
			{ name: 'en.json', path: 'l/en.json', sha: '1', text: '{"x":{"y":"XY"}}' },
			{ name: 'es.json', path: 'l/es.json', sha: '2', text: '{"x":{"y":{"sub":"Otro"}}}' }
		],
		'l',
		'en'
	);
	assert.equal(doc.isFixed('es', 'x.y'), true);
	assert.equal(doc.isFixed('en', 'x.y'), false);
	doc.set('es', 'x.y', 'Hola');
	doc.set('en', 'x.y', 'New');
	const out = doc.outputFiles();
	assert.deepEqual(out.map((f) => f.lang), ['en']);
	assert.deepEqual(JSON.parse(out[0].text), { x: { y: 'New' } });
});
