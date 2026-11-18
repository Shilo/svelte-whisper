// Locale file round-tripping.
//
// svelte-whisper resolves a key by first looking for a literal (flat) key and then
// by walking a dotted path through nested objects. The editor shows every string
// under the dotted key the library would use, and writes changes back in the
// shape the file already has, so a diff only touches the lines that changed.

/** @typedef {{ text: string, data: Record<string, any>, indent: string, eol: string, finalNewline: boolean, nested: boolean }} ParsedFile */

/**
 * Parse a locale file and remember how it was formatted.
 * @param {string} text
 * @returns {ParsedFile}
 */
export function parseFile(text) {
	const data = text.trim() ? JSON.parse(text) : {};
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('A locale file must contain a JSON object.');
	}
	const indent = text.match(/^[ \t]+(?=")/m)?.[0] ?? '\t';
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	return {
		text,
		data,
		indent,
		eol,
		finalNewline: text === '' || /\n$/.test(text),
		nested: Object.values(data).some(isObject)
	};
}

/** @param {unknown} v */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Flatten a locale object to dotted keys. Non-string leaves (numbers, arrays,
 * booleans) are returned separately: they are kept in the file but not editable.
 * @param {Record<string, any>} data
 */
export function flatten(data) {
	/** @type {Record<string, string>} */
	const strings = {};
	/** @type {Record<string, string>} */
	const other = {};
	const walk = (obj, prefix) => {
		for (const [k, v] of Object.entries(obj)) {
			const key = prefix ? `${prefix}.${k}` : k;
			if (typeof v === 'string') strings[key] = v;
			else if (isObject(v)) walk(v, key);
			else other[key] = JSON.stringify(v);
		}
	};
	walk(data, '');
	return { strings, other };
}

/**
 * Apply edits to a parsed file and serialize it in the file's own format.
 * `edits` maps a dotted key to its new string, or to `null` to remove it.
 * @param {ParsedFile | null} file  null for a language file that does not exist yet
 * @param {Record<string, string | null>} edits
 * @param {{ nested?: boolean }} [hint]  shape to use for a new file
 */
export function serialize(file, edits, hint = {}) {
	const data = structuredClone(file?.data ?? {});
	const nested = file ? file.nested : !!hint.nested;
	for (const [key, value] of Object.entries(edits)) {
		if (value === null) remove(data, key);
		else set(data, key, value, nested);
	}
	const indent = file?.indent ?? '\t';
	const eol = file?.eol ?? '\n';
	let out = JSON.stringify(data, null, indent);
	if (eol !== '\n') out = out.replace(/\n/g, eol);
	return (file ? file.finalNewline : true) ? out + eol : out;
}

/** @param {Record<string, any>} data @param {string} key @param {string} value @param {boolean} nested */
function set(data, key, value, nested) {
	if (Object.hasOwn(data, key) || !key.includes('.')) {
		data[key] = value;
		return;
	}
	const parts = key.split('.');
	// Follow the existing structure as far as it goes.
	let obj = data;
	let i = 0;
	while (i < parts.length - 1 && isObject(obj[parts[i]])) obj = obj[parts[i++]];
	const rest = parts.slice(i);
	if (i === 0 && !nested) {
		data[key] = value; // flat file: keep the dotted key literal
		return;
	}
	if (rest.length > 1 && obj[rest[0]] !== undefined) {
		// A string sits where an object would need to go; fall back to a literal key.
		obj[rest.join('.')] = value;
		return;
	}
	for (let j = 0; j < rest.length - 1; j++) obj = obj[rest[j]] = {};
	obj[rest[rest.length - 1]] = value;
}

/** @param {Record<string, any>} data @param {string} key */
function remove(data, key) {
	if (Object.hasOwn(data, key)) {
		delete data[key];
		return;
	}
	const parts = key.split('.');
	const trail = [data];
	for (let i = 0; i < parts.length - 1; i++) {
		const next = trail[i][parts[i]];
		if (!isObject(next)) return;
		trail.push(next);
	}
	delete trail[trail.length - 1][parts[parts.length - 1]];
	// Prune objects the removal left empty.
	for (let i = trail.length - 1; i > 0; i--) {
		if (Object.keys(trail[i]).length) break;
		delete trail[i - 1][parts[i - 1]];
	}
}

const PLACEHOLDER = /\{([^{}]*)\}/g;

/**
 * Interpolation placeholders in a string, as svelte-whisper reads them:
 * `{name}`, `{0}` and positional `{}` (returned as an empty string).
 * @param {string | undefined} text
 */
export function placeholders(text) {
	if (!text || !text.includes('{')) return [];
	return [...text.matchAll(PLACEHOLDER)].map((m) => m[1].trim());
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
	if (!want.length && !have.length) return null;
	const left = [...have];
	const missing = [];
	for (const p of want) {
		const i = left.indexOf(p);
		if (i === -1) missing.push(p);
		else left.splice(i, 1);
	}
	return missing.length || left.length ? { missing, extra: left } : null;
}

/** @param {string} p */
export const showPlaceholder = (p) => `{${p}}`;
