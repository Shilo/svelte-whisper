// Locale file round-tripping.
//
// svelte-whisper resolves a key by first looking for a literal (flat) key and then
// by walking a dotted path through nested objects. The editor shows every string
// under the dotted key the library would use, and writes changes back in the
// shape the file already has: indentation, line endings, final newline, nested
// or flat keys, and key order. JSON.stringify normalises the rest (see README).

/** @typedef {{ text: string, data: Record<string, any>, bom: boolean, indent: string, eol: string, finalNewline: boolean, nested: boolean }} ParsedFile */

/**
 * Parse a locale file and remember how it was formatted.
 * @param {string} text
 * @returns {ParsedFile}
 */
export function parseFile(text) {
	const bom = text.startsWith('﻿');
	const body = bom ? text.slice(1) : text;
	const data = body.trim() ? JSON.parse(body) : {};
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('A locale file must contain a JSON object.');
	}
	const indent = text.match(/^[ \t]+(?=")/m)?.[0] ?? '\t';
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	return {
		text,
		data,
		bom,
		indent,
		eol,
		finalNewline: text === '' || /\n$/.test(text),
		nested: Object.values(data).some(isObject)
	};
}

/** @param {unknown} v */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Flatten a locale object to dotted keys. `null` means "not translated yet", as in
 * svelte-whisper: its keys are listed in `empty`. Other non-string leaves (numbers,
 * arrays, booleans) are returned in `other`: kept in the file but not editable.
 * Throws when two properties flatten to the same key, as in `{"a.b": …, "a": {"b": …}}`:
 * the file holds two values for one message, and only its author can say which is right.
 * @param {Record<string, any>} data
 */
export function flatten(data) {
	/** @type {Record<string, string>} */
	const strings = {};
	/** @type {Record<string, string>} */
	const other = {};
	/** @type {string[]} */
	const empty = [];
	/** @type {string[]} every leaf, in file order */
	const keys = [];
	const seen = new Set();
	/** @param {Record<string, any>} obj @param {string} prefix */
	const walk = (obj, prefix) => {
		for (const [k, v] of Object.entries(obj)) {
			const key = prefix ? `${prefix}.${k}` : k;
			if (isObject(v)) {
				walk(v, key);
				continue;
			}
			if (seen.has(key)) throw new Error(`defines ${key} twice, once nested and once as a dotted key`);
			seen.add(key);
			keys.push(key);
			if (typeof v === 'string') strings[key] = v;
			else if (v === null) empty.push(key);
			else other[key] = JSON.stringify(v);
		}
	};
	walk(data, '');
	return { strings, other, empty, keys };
}

/**
 * Apply edits to a parsed file and serialize it in the file's own format.
 * `edits` maps a dotted key to its new string, or to `null` to remove it.
 * @param {ParsedFile | null} file  null for a language file that does not exist yet
 * @param {Record<string, string | null>} edits
 * @param {{ nested?: boolean, order?: string[], nulls?: string[] }} [hint]  `nested`: shape to use for a new file.
 *   `order`: every key in the source language's order, so a new key lands where the source has it.
 *   `nulls`: keys to write as `null` ("not translated yet"), such as a renamed key that was null.
 */
export function serialize(file, edits, hint = {}) {
	const nulls = hint.nulls ?? [];
	if (file && !Object.keys(edits).length && !nulls.length) return file.text;
	const data = structuredClone(file?.data ?? {});
	const nested = file ? file.nested : !!hint.nested;
	const order = hint.order ?? [];
	for (const [key, value] of Object.entries(edits)) {
		if (value === null) remove(data, key);
		else set(data, key, value, nested, order);
	}
	for (const key of nulls) set(data, key, null, nested, order);
	const indent = file?.indent ?? '\t';
	const eol = file?.eol ?? '\n';
	let out = JSON.stringify(data, null, indent);
	if (eol !== '\n') out = out.replace(/\n/g, eol);
	if (file?.bom) out = '﻿' + out;
	return (file ? file.finalNewline : true) ? out + eol : out;
}

/**
 * Find where a dotted key already lives, following nested objects and literal
 * dotted keys at any level: `a.b.c` may be `{"a":{"b.c":…}}` or `{"a.b":{"c":…}}`.
 * Returns the [object, property] steps down to the leaf, or null when it is new.
 * @param {Record<string, any>} obj @param {string[]} parts
 * @returns {[Record<string, any>, string][] | null}
 */
function locate(obj, parts) {
	for (let n = parts.length; n > 0; n--) {
		const name = parts.slice(0, n).join('.');
		if (!Object.hasOwn(obj, name)) continue;
		if (n === parts.length) return isObject(obj[name]) ? null : [[obj, name]];
		if (!isObject(obj[name])) continue;
		const rest = locate(obj[name], parts.slice(n));
		if (rest) return [[obj, name], ...rest];
	}
	return null;
}

/**
 * @param {Record<string, any>} data @param {string} key @param {string | null} value
 * @param {boolean} nested @param {string[]} order
 */
function set(data, key, value, nested, order) {
	const found = locate(data, key.split('.'));
	if (found) {
		const [obj, name] = found[found.length - 1];
		obj[name] = value; // an existing property keeps its position
		return;
	}
	if (!key.includes('.')) {
		place(data, key, value, '', order);
		return;
	}
	const parts = key.split('.');
	// Follow the existing structure as far as it goes.
	let obj = data;
	let i = 0;
	while (i < parts.length - 1 && isObject(obj[parts[i]])) obj = obj[parts[i++]];
	const rest = parts.slice(i);
	const prefix = parts.slice(0, i).map((part) => part + '.').join('');
	if (i === 0 && !nested) {
		place(data, key, value, '', order); // flat file: keep the dotted key literal
		return;
	}
	if (rest.length > 1 && obj[rest[0]] !== undefined) {
		// A string sits where an object would need to go; fall back to a literal key.
		place(obj, rest.join('.'), value, prefix, order);
		return;
	}
	// Build any missing groups, then put the new branch in its place.
	/** @type {any} */
	let branch = value;
	for (let j = rest.length - 1; j > 0; j--) branch = { [rest[j]]: branch };
	place(obj, rest[0], branch, prefix, order);
}

/**
 * Set `obj[name]`. An existing property keeps its position. A new one goes right after the
 * closest earlier sibling in the source's key order, so files stay in step with the source
 * instead of collecting every new translation at the bottom.
 * @param {Record<string, any>} obj @param {string} name @param {any} value
 * @param {string} prefix  dotted path of `obj`, with a trailing dot, or ''
 * @param {string[]} order
 */
function place(obj, name, value, prefix, order) {
	const isNew = !Object.hasOwn(obj, name);
	obj[name] = value;
	const full = prefix + name;
	const at = order.findIndex((key) => key === full || key.startsWith(full + '.'));
	if (!isNew || at < 0) return;
	let after = null;
	for (let i = at - 1; i >= 0 && after === null; i--) {
		if (!order[i].startsWith(prefix)) continue;
		const rest = order[i].slice(prefix.length);
		const sibling = Object.hasOwn(obj, rest) ? rest : rest.split('.')[0];
		if (sibling !== name && Object.hasOwn(obj, sibling)) after = sibling;
	}
	const entries = Object.entries(obj).filter(([key]) => key !== name);
	entries.splice(after === null ? 0 : entries.findIndex(([key]) => key === after) + 1, 0, [name, value]);
	for (const key of Object.keys(obj)) delete obj[key];
	for (const [key, entry] of entries) obj[key] = entry;
}

/** @param {Record<string, any>} data @param {string} key */
function remove(data, key) {
	const found = locate(data, key.split('.'));
	if (!found) return;
	// Delete the leaf, then any objects the removal left empty.
	for (let i = found.length - 1; i >= 0; i--) {
		const [obj, name] = found[i];
		if (i < found.length - 1 && Object.keys(obj[name]).length) break;
		delete obj[name];
	}
}

const PLACEHOLDER = /\{([^{}]*)\}/g;

/**
 * Interpolation placeholders in a string, as svelte-whisper reads them: named
 * `{name}` and indexed `{0}`, each listed once. Empty braces `{}` are plain text.
 * @param {string | undefined} text
 */
export function placeholders(text) {
	if (!text || !text.includes('{')) return [];
	return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1].trim()).filter(Boolean))];
}

/**
 * Compare a translation's placeholders with the source string's.
 * @param {string | undefined} source
 * @param {string | undefined} translation
 * @returns {{ missing: string[], extra: string[] } | null}  null when they match
 */
export function comparePlaceholders(source, translation) {
	if (!translation) return null;
	const want = placeholders(source);
	const have = placeholders(translation);
	const missing = want.filter((p) => !have.includes(p));
	const extra = have.filter((p) => !want.includes(p));
	return missing.length || extra.length ? { missing, extra } : null;
}

/** @param {string} p */
export const showPlaceholder = (p) => `{${p}}`;
