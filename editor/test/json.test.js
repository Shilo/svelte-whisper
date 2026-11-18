import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFile, flatten, serialize, placeholders, comparePlaceholders } from '../src/lib/json.js';
import { isLocaleFile } from '../src/lib/lang.js';

const edit = (text, edits, hint) => serialize(parseFile(text), edits, hint);

test('editing one key leaves every other line byte-identical', () => {
	// CRLF, four-space indent, a final newline and keys out of alphabetical order.
	const lines = ['{', '    "zeta": "Z",', '    "group": {', '        "b": "old",', '        "a": "A"', '    },', '    "alpha": "first"', '}', ''];
	const out = edit(lines.join('\r\n'), { 'group.b': 'new' }).split('\r\n');
	assert.equal(out.length, lines.length);
	for (let i = 0; i < lines.length; i++) assert.equal(out[i], i === 3 ? '        "b": "new",' : lines[i], `line ${i + 1}`);
	assert.ok(!out.some((line) => line.includes('\n')), 'no bare LF');
});

test('edits keep the indentation, line endings and final newline', () => {
	assert.equal(edit('{\r\n  "a": "x",\r\n  "b": "y"\r\n}\r\n', { a: 'z' }), '{\r\n  "a": "z",\r\n  "b": "y"\r\n}\r\n');
	assert.equal(edit('{\n\t"a": "x"\n}', { a: 'z' }), '{\n\t"a": "z"\n}');
	assert.equal(edit('{\n    "a": "x"\n}\n', { a: 'z' }), '{\n    "a": "z"\n}\n');
});

test('a byte order mark is kept', () => {
	assert.equal(edit('\uFEFF{\n\t"a": "x"\n}\n', { a: 'z' }), '\uFEFF{\n\t"a": "z"\n}\n');
});

test('nested files stay nested and flat files stay flat', () => {
	assert.equal(edit('{\n\t"a": {\n\t\t"b": "x"\n\t}\n}\n', { 'a.c': 'y' }), '{\n\t"a": {\n\t\t"b": "x",\n\t\t"c": "y"\n\t}\n}\n');
	assert.equal(edit('{\n\t"a.b": "x"\n}\n', { 'a.c': 'y' }), '{\n\t"a.b": "x",\n\t"a.c": "y"\n}\n');
});

test('a new key is placed after its closest earlier sibling in the source order', () => {
	const order = ['title', 'nav.home', 'nav.help', 'nav.about', 'footer'];
	const out = edit('{\n\t"title": "T",\n\t"nav": {\n\t\t"home": "H",\n\t\t"about": "A"\n\t},\n\t"footer": "F"\n}\n', { 'nav.help': 'X' }, { order });
	assert.deepEqual(Object.keys(JSON.parse(out).nav), ['home', 'help', 'about']);
	const top = edit('{\n\t"footer": "F"\n}\n', { title: 'T' }, { order });
	assert.deepEqual(Object.keys(JSON.parse(top)), ['title', 'footer']);
});

test('a literal dotted key inside a nested object is edited and removed in place', () => {
	const text = '{\n\t"a": {\n\t\t"b.c": "x",\n\t\t"d": "y"\n\t}\n}\n';
	assert.equal(edit(text, { 'a.b.c': 'z' }), '{\n\t"a": {\n\t\t"b.c": "z",\n\t\t"d": "y"\n\t}\n}\n');
	assert.equal(edit(text, { 'a.b.c': null }), '{\n\t"a": {\n\t\t"d": "y"\n\t}\n}\n');
	// A nested object under a dotted name works the same way.
	assert.equal(edit('{"a.b":{"c":"x"}}', { 'a.b.c': 'z' }), '{\n\t"a.b": {\n\t\t"c": "z"\n\t}\n}');
});

test('removing the last key of a group prunes the groups it leaves empty', () => {
	assert.equal(edit('{\n\t"a": {\n\t\t"b": {\n\t\t\t"c": "x"\n\t\t}\n\t},\n\t"d": "y"\n}\n', { 'a.b.c': null }), '{\n\t"d": "y"\n}\n');
	assert.equal(edit('{\n\t"a": {\n\t\t"b.c": "x"\n\t}\n}\n', { 'a.b.c': null }), '{}\n');
});

test('null reads as untranslated and is replaced in place', () => {
	const { strings, empty } = flatten({ a: null, b: 'x', c: { d: null } });
	assert.deepEqual(strings, { b: 'x' });
	assert.deepEqual(empty, ['a', 'c.d']);
	assert.equal(edit('{\n\t"a": null,\n\t"b": "x"\n}\n', { a: 'y' }), '{\n\t"a": "y",\n\t"b": "x"\n}\n');
});

test('placeholders are named or indexed; empty braces are plain text', () => {
	assert.deepEqual(placeholders('Hi {name}, {0} and { count }'), ['name', '0', 'count']);
	assert.deepEqual(placeholders('Use {} or { } literally'), []);
	assert.deepEqual(comparePlaceholders('Hi {name}', 'Salut {nom}'), { missing: ['name'], extra: ['nom'] });
	assert.deepEqual(comparePlaceholders('{0} of {1}', '{1} de {0}'), null);
	assert.deepEqual(comparePlaceholders('{0} notes', 'notes'), { missing: ['0'], extra: [] });
	assert.equal(comparePlaceholders('Braces {} here', 'Accolades {} ici'), null);
	assert.equal(comparePlaceholders('Plain', 'Avec {}'), null);
});

test('a repeated placeholder counts once', () => {
	assert.deepEqual(placeholders('{n} and {n} and { n }'), ['n']);
	assert.equal(comparePlaceholders('{name}, {name}!', 'Salut {name}'), null);
	assert.deepEqual(comparePlaceholders('{a} {a}', '{b} {b}'), { missing: ['a'], extra: ['b'] });
});

test('flatten refuses a key defined twice', () => {
	assert.throws(() => flatten({ 'a.b': 'literal', a: { b: 'nested' } }), /defines a\.b twice/);
	assert.throws(() => flatten({ a: { 'b.c': null }, 'a.b': { c: 'x' } }), /defines a\.b\.c twice/);
});

test('only files named like a language tag are locales', () => {
	for (const name of ['en.json', 'pt-BR.json', 'zh-Hant.json', 'sr-Latn-RS.json', 'fil.json']) assert.ok(isLocaleFile(name), name);
	for (const name of ['tsconfig.json', 'notes.json', 'en.yaml', 'pt_BR.json', 'e.json', 'glossary.json']) {
		assert.ok(!isLocaleFile(name), name);
	}
});
