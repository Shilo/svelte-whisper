import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flushSync } from 'svelte';
import { makeDoc, output } from './helpers.js';

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
	assert.equal(doc.warning('ru', 'items.few'), null);
	doc.set('ru', 'items.few', 'предмета');
	assert.deepEqual(doc.warning('ru', 'items.few'), { missing: ['count'], extra: [] });
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
