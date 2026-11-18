// The local draft: restored exactly when the files are the ones it was made against,
// and restored as far as possible, reporting the rest, when they changed on GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc, output } from './helpers.js';
import { flatten } from '../src/lib/json.js';

/** The draft as the app stores it: through JSON, as localStorage does. */
const saved = (doc) => JSON.parse(JSON.stringify(doc.toDraft()));

/** Reload: the same files, fresh, with the draft applied. */
function reload(files, doc) {
	const next = makeDoc(files);
	assert.deepEqual(next.applyDraft(saved(doc)), []);
	return next;
}

/** Everything that is sent or saved is the same before and after the reload. */
function assertSame(next, doc) {
	assert.deepEqual(next.outputFiles(), doc.outputFiles());
	assert.deepEqual(next.toDraft(), doc.toDraft());
	assert.deepEqual(next.edits(), doc.edits());
	assert.equal(next.changeCount(), doc.changeCount());
}

/** mulberry32: a small seeded generator, so a failing sequence can be replayed. */
function random(seed) {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const pick = (list) => list[Math.floor(next() * list.length)];
	return { next, pick, int: (n) => Math.floor(next() * n) };
}

// Nested keys, a plural group, literal dotted keys, nulls, a non-string value, a language
// missing keys, a flat file with no final newline.
const FILES = {
	en: {
		app: { title: 'Fieldnotes', tagline: 'Notes' },
		items: { one: '{count} item', other: '{count} items' },
		'lit.key': 'Literal',
		greet: 'Hi {name}',
		limit: 3,
		a: 'A',
		b: ''
	},
	fr: { app: { title: 'Carnets' }, items: { other: '{count} articles' }, 'lit.key': null, greet: null, a: 'Ah', limit: 4 },
	de: '{\n  "app.title": "Titel",\n  "a": "Ach",\n  "b": null,\n  "items.one": "{count} Ding"\n}'
};
const NAMES = ['a', 'b', 'x', 'y', 'tmp', 'n', 'app.title', 'app.name', 'app.tagline', 'items.one', 'items.few', 'items.other', 'lit.key', 'lit', 'greet', 'limit'];
const TEXTS = ['One', 'Two {count}', 'A', 'Ah', 'Fieldnotes', 'Carnets', 'x'];
const LANGS = ['ja', 'pt-BR', 'de'];

/** Run 1 to 25 random operations the way the app calls them; returns the list, for messages. */
function randomEdits(doc, r) {
	const ops = [];
	for (let i = 1 + r.int(25); i > 0; i--) {
		const key = r.pick(doc.keys);
		const lang = r.pick(doc.langs);
		switch (r.int(8)) {
			case 0:
			case 1: {
				const text = r.pick(TEXTS);
				ops.push(`set ${lang} ${key} ${JSON.stringify(text)}`);
				doc.set(lang, key, text);
				break;
			}
			case 2:
				ops.push(`clear ${lang} ${key}`);
				doc.set(lang, key, '');
				break;
			case 3: {
				const name = r.pick(NAMES);
				ops.push(`add ${name}`);
				if (!doc.validateKey(name)) doc.addKey(name);
				break;
			}
			case 4: {
				const to = r.pick(NAMES);
				ops.push(`rename ${key} ${to}`);
				if (!doc.validateKey(to, key)) doc.renameKey(key, to);
				break;
			}
			case 5:
				ops.push(`delete ${key}`);
				doc.deleteKey(key);
				break;
			case 6: {
				const gone = Object.keys(doc.deleted);
				const k = gone.length ? r.pick(gone) : key;
				ops.push(`restore ${k}`);
				doc.restoreKey(k);
				break;
			}
			default:
				if (r.next() < 0.5) {
					const l = r.pick(LANGS);
					ops.push(`add language ${l}`);
					doc.addLanguage(l);
				} else {
					ops.push(`source ${lang}`);
					doc.setSource(lang);
				}
		}
	}
	return ops;
}

test('property: with the same files, a reload restores exactly what would be sent and saved', () => {
	for (let seed = 1; seed <= 2500; seed++) {
		const r = random(seed);
		const doc = makeDoc(FILES);
		const ops = randomEdits(doc, r);
		try {
			const next = reload(FILES, doc);
			assertSame(next, doc);
			// Rows marked for deletion keep their text: restoring them gives the same result.
			for (const k of Object.keys(doc.deleted)) doc.restoreKey(k), next.restoreKey(k);
			assertSame(next, doc);
		} catch (e) {
			e.message = `seed ${seed}: ${ops.join('; ')}\n${e.message}`;
			throw e;
		}
	}
});

test('round 3: a key renamed away and added again under its old name survives a reload', () => {
	const files = { en: { app: { title: 'Fieldnotes', tagline: 'Notes' } }, fr: { app: { title: 'Carnets', tagline: 'Notes' } } };
	const doc = makeDoc(files);
	doc.renameKey('app.title', 'app.name');
	doc.addKey('app.title');
	doc.set('en', 'app.title', 'New title');
	assert.ok(doc.isNewKey('app.title'));
	const next = reload(files, doc);
	assertSame(next, doc);
	assert.equal(next.get('en', 'app.title'), 'New title');
	assert.equal(next.get('en', 'app.name'), 'Fieldnotes');
	assert.deepEqual(JSON.parse(output(next, 'en')).app, { title: 'New title', tagline: 'Notes', name: 'Fieldnotes' });
});

test('round 3: a renamed key deleted before a reload comes back with its text when restored', () => {
	const files = { en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } };
	const before = makeDoc(files);
	before.renameKey('a', 'x');
	before.deleteKey('x');
	const next = reload(files, before);
	assertSame(next, before);
	before.restoreKey('x');
	next.restoreKey('x');
	assert.equal(next.get('en', 'x'), 'A');
	assert.equal(next.get('fr', 'x'), 'Ah');
	assertSame(next, before);
});

test('round 2: a chain of renames survives a reload', () => {
	const files = { en: { a: 'A', x: 'X' }, fr: { a: 'Ah', x: 'Iks' } };
	const doc = makeDoc(files);
	doc.renameKey('x', 'y');
	doc.renameKey('a', 'x');
	assert.deepEqual(JSON.parse(output(doc, 'en')), { x: 'A', y: 'X' });
	assertSame(reload(files, doc), doc);
});

test('round 2: a swap through a temporary name survives a reload', () => {
	// fr has the same text under both names, so the swap leaves no edit there.
	const files = { en: { a: 'A', b: 'B', c: 'C' }, fr: { a: 'Même', b: 'Même', c: 'Cé' } };
	const doc = makeDoc(files);
	doc.renameKey('a', 'tmp');
	doc.renameKey('b', 'a');
	doc.renameKey('tmp', 'b');
	assert.deepEqual(JSON.parse(output(doc, 'en')), { a: 'B', b: 'A', c: 'C' });
	const next = reload(files, doc);
	assertSame(next, doc);
	assert.deepEqual(next.keys, ['b', 'a', 'c']);
});

test('a draft in an older format is ignored', () => {
	const doc = makeDoc(FILES);
	assert.deepEqual(doc.applyDraft(/** @type {any} */ ({ edits: { en: { a: 'Z' } }, deleted: [], removed: [], added: [], renamed: {}, langs: [] })), []);
	assert.equal(doc.changeCount(), 0);
});

// ── Files changed on GitHub since the draft was saved ──────────────

/** Apply the draft of `doc` to a later version of the files. */
const later = (files, doc) => {
	const next = makeDoc(files, 'en', '-2');
	return { next, lost: next.applyDraft(saved(doc)) };
};

test('upstream: an edited key renamed there is reported, not placed on the new name', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.set('fr', 'a', 'Ahh');
	const { next, lost } = later({ en: { c: 'A', b: 'B' }, fr: { c: 'Ah', b: 'Bé' } }, doc);
	assert.deepEqual(lost, [{ key: 'a', lang: 'fr' }]);
	assert.deepEqual(next.keys, ['c', 'b']);
	assert.equal(next.get('fr', 'c'), 'Ah');
	assert.equal(next.changeCount(), 0);
});

test('upstream: an edited key deleted there is reported', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.set('fr', 'a', 'Ahh');
	doc.set('fr', 'b', 'Bee');
	const { next, lost } = later({ en: { b: 'B' }, fr: { b: 'Bé' } }, doc);
	assert.deepEqual(lost, [{ key: 'a', lang: 'fr' }]);
	assert.equal(next.get('fr', 'b'), 'Bee');
	assert.equal(next.changeCount(), 1);
});

test('upstream: a key renamed here and deleted there reports the rename and its text', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.renameKey('a', 'x');
	doc.set('fr', 'x', 'Iks');
	const { next, lost } = later({ en: { b: 'B' }, fr: { b: 'Bé' } }, doc);
	assert.deepEqual(lost, [
		{ key: 'a', to: 'x' },
		{ key: 'x', lang: 'fr' }
	]);
	assert.deepEqual(next.keys, ['b']);
});

test('upstream: a rename target someone else added keeps their value, and the typed text stays on the source row', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.renameKey('a', 'x');
	doc.set('fr', 'x', 'Typed');
	const { next, lost } = later({ en: { a: 'A', b: 'B', x: 'Theirs' }, fr: { a: 'Ah', b: 'Bé' } }, doc);
	assert.deepEqual(lost, [{ key: 'a', to: 'x' }]);
	assert.equal(next.get('en', 'x'), 'Theirs');
	assert.equal(next.get('fr', 'x'), '');
	assert.equal(next.get('fr', 'a'), 'Typed');
	assert.deepEqual(next.renamed, {});
	assert.deepEqual(next.edits(), { fr: { a: 'Typed' } });
});

test('upstream: a new key that now exists there takes the typed text, shown as a change', () => {
	const doc = makeDoc({ en: { a: 'A' }, fr: { a: 'Ah' } });
	doc.addKey('n');
	doc.set('en', 'n', 'Mine');
	doc.set('fr', 'n', 'Le mien');
	const { next, lost } = later({ en: { a: 'A', n: 'Theirs' }, fr: { a: 'Ah' } }, doc);
	assert.deepEqual(lost, []);
	assert.equal(next.get('en', 'n'), 'Mine');
	assert.equal(next.get('fr', 'n'), 'Le mien');
	assert.ok(!next.isNewKey('n'));
	assert.deepEqual(
		next.outputFiles().find((f) => f.lang === 'en')?.changes,
		[{ key: 'n', before: 'Theirs', after: 'Mine' }]
	);
});

test('upstream: a changed value on a row renamed here but not edited shows the new value', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.renameKey('a', 'x');
	const { next, lost } = later({ en: { a: 'A2', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } }, doc);
	assert.deepEqual(lost, []);
	assert.equal(next.get('en', 'x'), 'A2');
	assert.deepEqual(next.renamed, { x: 'a' });
	assert.deepEqual(JSON.parse(output(next, 'en')), { x: 'A2', b: 'B' });
});

test('upstream: a language file added there is loaded, and one added here takes the typed text', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.set('fr', 'a', 'Ahh');
	doc.addLanguage('de');
	doc.set('de', 'a', 'Ach');
	const { next, lost } = later({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' }, de: { b: 'Be' }, ja: { a: 'エー' } }, doc);
	assert.deepEqual(lost, []);
	assert.deepEqual(next.langs, ['en', 'de', 'fr', 'ja']);
	assert.equal(next.get('fr', 'a'), 'Ahh');
	assert.equal(next.get('de', 'a'), 'Ach');
	assert.equal(next.get('de', 'b'), 'Be');
	assert.equal(next.get('ja', 'a'), 'エー');
	assert.ok(!next.outputFiles().find((f) => f.lang === 'de')?.isNew);
});

test('upstream: a language file deleted there reports the text typed into it', () => {
	const doc = makeDoc({ en: { a: 'A', b: 'B' }, fr: { a: 'Ah', b: 'Bé' } });
	doc.set('fr', 'a', 'Ahh');
	doc.set('en', 'b', 'Bee');
	const { next, lost } = later({ en: { a: 'A', b: 'B' } }, doc);
	assert.deepEqual(lost, [{ key: 'a', lang: 'fr' }]);
	assert.deepEqual(next.langs, ['en']);
	assert.equal(next.get('en', 'b'), 'Bee');
});

/** Every leaf of a file as a flat object, nulls and other values included. */
function flat(data) {
	const f = flatten(typeof data === 'string' ? JSON.parse(data) : data);
	return Object.fromEntries(f.keys.map((k) => [k, k in f.strings ? f.strings[k] : k in f.other ? JSON.parse(f.other[k]) : null]));
}

/** Random changes someone else made: keys added, removed and renamed, values changed, files added and removed. */
function randomUpstream(r) {
	/** @type {Record<string, Record<string, unknown>>} */
	const files = Object.fromEntries(Object.entries(FILES).map(([lang, data]) => [lang, flat(data)]));
	const keys = () => [...new Set(Object.values(files).flatMap(Object.keys))];
	const free = (name) => !keys().some((k) => k === name || k.startsWith(name + '.') || name.startsWith(k + '.'));
	const changes = [];
	for (let i = 1 + r.int(6); i > 0; i--) {
		const key = r.pick(keys());
		const name = r.pick(NAMES);
		switch (r.int(5)) {
			case 0:
				changes.push(`remove ${key}`);
				for (const f of Object.values(files)) delete f[key];
				break;
			case 1:
				if (!free(name)) break;
				changes.push(`add ${name}`);
				for (const f of Object.values(files)) if (r.next() < 0.7) f[name] = r.pick(TEXTS);
				break;
			case 2:
				if (!free(name) && name !== key) break;
				changes.push(`rename ${key} ${name}`);
				for (const f of Object.values(files)) {
					if (!(key in f)) continue;
					const v = f[key];
					delete f[key];
					f[name] = v;
				}
				break;
			case 3: {
				const lang = r.pick(Object.keys(files));
				changes.push(`change ${lang} ${key}`);
				files[lang][key] = r.pick(TEXTS);
				break;
			}
			default:
				if (files.fr && r.next() < 0.5) {
					changes.push('remove fr');
					delete files.fr;
				} else if (!files.ja) {
					changes.push('add ja');
					files.ja = { a: 'エー' };
				}
				break;
		}
	}
	return { files, changes };
}

test('property: with changed files, every typed box is restored or reported', () => {
	for (let seed = 1; seed <= 1000; seed++) {
		const r = random(seed);
		const doc = makeDoc(FILES);
		const ops = randomEdits(doc, r);
		const draft = saved(doc);
		const { files, changes } = randomUpstream(r);
		try {
			const next = makeDoc(files, 'en', '-2');
			const lost = next.applyDraft(draft);
			for (const [lang, cells] of Object.entries(draft.cells)) {
				for (const [key, text] of Object.entries(cells)) {
					if (lost.some((l) => l.key === key && l.lang === lang)) continue;
					// A rename that could not be applied leaves the text on the row's name in the files.
					const row = lost.find((l) => l.to === key)?.key ?? key;
					assert.ok(next.keys.includes(row), `${lang} ${key}: row ${row} is missing and not reported`);
					assert.equal(next.values[lang]?.[row] ?? null, text, `${lang} ${key} on ${row}`);
				}
			}
			next.outputFiles(); // and what would be sent can be built
		} catch (e) {
			e.message = `seed ${seed}: ${ops.join('; ')} | upstream: ${changes.join('; ')}\n${e.message}`;
			throw e;
		}
	}
});
