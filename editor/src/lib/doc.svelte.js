// The editable document: every locale file of one folder, flattened to dotted
// keys, plus the user's edits. Edits are always derived by comparing the
// current values with what was loaded, so undoing an edit by hand clears it.

import { parseFile, flatten, serialize, comparePlaceholders } from './json.js';

/** @typedef {{ name: string, path: string, sha: string | null, text: string }} SourceFile */
/** @typedef {{ key: string, before: string | undefined, after: string | undefined }} Change */
/** @typedef {{ lang: string, path: string, sha: string | null, isNew: boolean, changes: Change[], text: string }} OutFile */

/** BCP 47-ish file names: en, pt-BR, zh_Hant, sr-Latn-RS */
export const LANG_PATTERN = /^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})*$/;

/** Names svelte-whisper accepts inside a plural group: CLDR categories and exact counts. */
const PLURAL_CATEGORY = /^(zero|one|two|few|many|other|\d+)$/;

export class LocaleDoc {
	/** @type {string[]} */ langs = $state([]);
	/** @type {string[]} */ keys = $state([]);
	/** @type {Record<string, Record<string, string>>} */ values = $state({});
	/** @type {Record<string, true>} */ deleted = $state({});
	/** Keys renamed in this session: new name -> name in the files. */
	/** @type {Record<string, string>} */ renamed = $state({});
	source = $state('');
	dir = '';

	/** @type {Record<string, Record<string, string>>} values as loaded */
	base = {};
	/** @type {Record<string, Record<string, string>>} non-string leaves, shown read-only */
	fixed = {};
	/** @type {Record<string, { path: string, sha: string | null, parsed: import('./json.js').ParsedFile | null }>} */
	files = {};

	/**
	 * @param {SourceFile[]} list
	 * @param {string} dir
	 * @param {string} preferredSource
	 */
	constructor(list, dir, preferredSource) {
		this.dir = dir.replace(/\/+$/, '');
		const order = [];
		const seen = new Set();
		/** @type {Record<string, Record<string, string>>} */
		const values = {};
		for (const f of list) {
			const lang = f.name.replace(/\.json$/i, '');
			let parsed;
			try {
				parsed = parseFile(f.text);
			} catch (e) {
				throw new Error(`${f.name} is not valid JSON (${e.message}). Fix it in the repository first.`);
			}
			const { strings, other } = flatten(parsed.data);
			this.files[lang] = { path: f.path, sha: f.sha, parsed };
			this.base[lang] = strings;
			this.fixed[lang] = other;
			values[lang] = { ...strings };
		}
		const langs = Object.keys(values).sort();
		const source = langs.includes(preferredSource) ? preferredSource : langs.includes('en') ? 'en' : langs[0] || '';
		// Key order follows the source file, then anything only other files have.
		for (const lang of [source, ...langs]) {
			for (const k of Object.keys({ ...this.base[lang], ...this.fixed[lang] })) {
				if (!seen.has(k)) seen.add(k), order.push(k);
			}
		}
		this.source = source;
		this.langs = [source, ...langs.filter((l) => l !== source)].filter(Boolean);
		this.keys = order;
		this.values = values;
	}

	/** @param {string} lang @param {string} key */
	isFixed(lang, key) {
		return this.fixed[lang]?.[key] !== undefined;
	}

	/** @param {string} lang @param {string} key */
	get(lang, key) {
		return this.values[lang]?.[key] ?? '';
	}

	/** Empty text means "not translated": the key is removed from that file. */
	/** @param {string} lang @param {string} key @param {string} text */
	set(lang, key, text) {
		const row = this.values[lang];
		if (!row || this.isFixed(lang, key)) return;
		if (text === '') delete row[key];
		else row[key] = text;
	}

	/** @param {string} lang @param {string} key */
	isChanged(lang, key) {
		const from = this.renamed[key] ?? key;
		if (this.deleted[key]) return this.base[lang]?.[from] !== undefined;
		return from !== key || (this.base[lang]?.[key] ?? '') !== (this.values[lang]?.[key] ?? '');
	}

	/** @param {string} lang @param {string} key */
	isMissing(lang, key) {
		return !this.values[lang]?.[key] && !this.isFixed(lang, key) && !this.isOptional(lang, key);
	}

	/**
	 * Plural groups, by parent key: `{ "one": …, "other": … }`. svelte-whisper picks a
	 * category with Intl.PluralRules, and each language uses its own set of categories.
	 */
	#plurals = $derived.by(() => {
		/** @type {Map<string, { plural: boolean, other: boolean }>} */
		const groups = new Map();
		for (const k of this.keys) {
			const dot = k.lastIndexOf('.');
			if (dot < 1 || this.deleted[k]) continue;
			const parent = k.slice(0, dot);
			const name = k.slice(dot + 1);
			const group = groups.get(parent) ?? { plural: true, other: false };
			if (!PLURAL_CATEGORY.test(name)) group.plural = false;
			if (name === 'other') group.other = true;
			groups.set(parent, group);
		}
		return new Set([...groups].filter(([, g]) => g.plural && g.other).map(([parent]) => parent));
	});

	/**
	 * A plural category other than `other` may be left out once the language has its
	 * `other` form: Japanese needs only `other`, Russian also needs `few` and `many`.
	 */
	/** @param {string} lang @param {string} key */
	isOptional(lang, key) {
		const dot = key.lastIndexOf('.');
		if (dot < 1 || key.endsWith('.other')) return false;
		const parent = key.slice(0, dot);
		return this.#plurals.has(parent) && !!this.values[lang]?.[parent + '.other'];
	}

	/** Placeholder mismatch against the source language, or null. */
	/** @param {string} lang @param {string} key */
	warning(lang, key) {
		if (lang === this.source) return null;
		const source = this.values[this.source];
		let expected = source?.[key];
		// A plural category the source language does not use is checked against its `other` form.
		const parent = key.slice(0, Math.max(0, key.lastIndexOf('.')));
		if (expected === undefined && this.#plurals.has(parent)) expected = source?.[parent + '.other'];
		return comparePlaceholders(expected, this.values[lang]?.[key]);
	}

	/** Untranslated boxes per language, computed in one pass. */
	#missing = $derived.by(() => {
		/** @type {Record<string, number>} */
		const out = {};
		for (const lang of this.langs) {
			const row = this.values[lang];
			const fixed = this.fixed[lang];
			let n = 0;
			for (const k of this.keys) {
				if (!row[k] && !this.deleted[k] && fixed?.[k] === undefined && !this.isOptional(lang, k)) n++;
			}
			out[lang] = n;
		}
		return out;
	});

	/** @param {string} lang */
	missingCount(lang) {
		return this.#missing[lang] ?? 0;
	}

	get liveKeyCount() {
		return this.keys.filter((k) => !this.deleted[k]).length;
	}

	/** True when the key is new in this session. */
	/** @param {string} key */
	isNewKey(key) {
		if (this.renamed[key]) return false;
		return this.langs.every((l) => this.base[l]?.[key] === undefined && this.fixed[l]?.[key] === undefined);
	}

	/**
	 * @param {string} key
	 * @returns {string | null} an error message, or null when the key is acceptable
	 */
	validateKey(key, current = '') {
		if (!key.trim()) return 'Enter a key.';
		if (key !== key.trim() || /\s/.test(key)) return 'Keys cannot contain spaces.';
		if (/^\.|\.$|\.\./.test(key)) return 'Dots separate path segments; a segment cannot be empty.';
		if (key !== current && this.keys.includes(key)) return 'That key already exists.';
		const clash = this.keys.find((k) => k !== current && (k.startsWith(key + '.') || key.startsWith(k + '.')));
		if (clash) return `Conflicts with “${clash}”: a key cannot be both a string and a group.`;
		return null;
	}

	/** @param {string} key */
	addKey(key) {
		// Place it after the last key that shares the longest prefix.
		const parts = key.split('.');
		let at = this.keys.length;
		for (let n = parts.length - 1; n > 0; n--) {
			const prefix = parts.slice(0, n).join('.') + '.';
			const last = this.keys.findLastIndex((k) => k.startsWith(prefix));
			if (last !== -1) {
				at = last + 1;
				break;
			}
		}
		this.keys.splice(at, 0, key);
	}

	/** @param {string} from @param {string} to */
	renameKey(from, to) {
		const i = this.keys.indexOf(from);
		if (i === -1 || from === to) return;
		this.keys[i] = to;
		const original = this.renamed[from] ?? from;
		delete this.renamed[from];
		if (original !== to && !this.isNewKey(original)) this.renamed[to] = original;
		for (const lang of this.langs) {
			const row = this.values[lang];
			if (row[from] !== undefined) {
				row[to] = row[from];
				delete row[from];
			}
		}
	}

	/** Mark a key for deletion; it stays visible, struck through, until restored or sent. */
	/** @param {string} key */
	deleteKey(key) {
		if (this.isNewKey(key)) {
			this.keys.splice(this.keys.indexOf(key), 1);
			for (const lang of this.langs) delete this.values[lang][key];
		} else {
			this.deleted[key] = true;
		}
	}

	/** @param {string} key */
	restoreKey(key) {
		delete this.deleted[key];
	}

	/** @param {string} lang */
	addLanguage(lang) {
		if (this.values[lang]) return;
		this.values[lang] = {};
		this.base[lang] = {};
		this.fixed[lang] = {};
		this.files[lang] = { path: `${this.dir}/${lang}.json`, sha: null, parsed: null };
		this.langs.push(lang);
	}

	/** @param {string} lang */
	setSource(lang) {
		if (!this.values[lang]) return;
		this.source = lang;
		this.langs = [lang, ...this.langs.filter((l) => l !== lang)];
	}

	#edits = $derived.by(() => this.#computeEdits());
	#changeCount = $derived(Object.values(this.#edits).reduce((n, e) => n + Object.keys(e).length, 0));

	/** Per-language edits: key -> new string, or null for removal. */
	edits() {
		return this.#edits;
	}

	#computeEdits() {
		/** @type {Record<string, Record<string, string | null>>} */
		const out = {};
		const live = new Set(this.keys);
		for (const lang of this.langs) {
			/** @type {Record<string, string | null>} */
			const e = {};
			const base = this.base[lang];
			const cur = this.values[lang];
			for (const k of this.keys) {
				if (this.isFixed(lang, k)) continue;
				const before = base[k];
				const after = this.deleted[k] ? undefined : cur[k];
				if (before !== after) e[k] = after ?? null;
			}
			// Keys renamed away disappear from this.keys entirely.
			for (const k of Object.keys(base)) if (!live.has(k)) e[k] = null;
			const isNew = this.files[lang].sha === null && !this.files[lang].parsed;
			if (Object.keys(e).length || isNew) out[lang] = e;
		}
		return out;
	}

	/** Count of changed cells, for the status bar. */
	changeCount() {
		return this.#changeCount;
	}

	/** @returns {OutFile[]} */
	outputFiles() {
		const sourceNested = this.files[this.source]?.parsed?.nested ?? false;
		return Object.entries(this.edits()).map(([lang, e]) => {
			const f = this.files[lang];
			return {
				lang,
				path: f.path,
				sha: f.sha,
				isNew: !f.parsed,
				changes: Object.entries(e).map(([key, after]) => ({
					key,
					before: this.base[lang][key],
					after: after ?? undefined
				})),
				text: serialize(f.parsed, e, { nested: sourceNested })
			};
		});
	}

	/** A compact, JSON-safe record of the edits, for the local draft. */
	toDraft() {
		const live = new Set(this.keys);
		return {
			edits: this.edits(),
			deleted: Object.keys(this.deleted),
			removed: this.langs.flatMap((l) => Object.keys(this.base[l])).filter((k) => !live.has(k)),
			added: this.keys.filter((k) => this.isNewKey(k)),
			renamed: $state.snapshot(this.renamed),
			langs: this.langs.filter((l) => !this.files[l].parsed)
		};
	}

	/** @param {ReturnType<LocaleDoc['toDraft']>} d */
	applyDraft(d) {
		for (const lang of d.langs || []) if (LANG_PATTERN.test(lang)) this.addLanguage(lang);
		const removed = new Set(d.removed || []);
		const deleted = new Set(d.deleted || []);
		if (removed.size) this.keys = this.keys.filter((k) => !removed.has(k));
		for (const k of d.added || []) if (!this.keys.includes(k)) this.addKey(k);
		for (const [lang, e] of Object.entries(d.edits || {})) {
			if (!this.values[lang]) continue;
			for (const [k, v] of Object.entries(e)) {
				if (!this.keys.includes(k) || deleted.has(k)) continue;
				if (v === null) delete this.values[lang][k];
				else if (typeof v === 'string') this.values[lang][k] = v;
			}
		}
		for (const k of deleted) if (this.keys.includes(k)) this.deleted[k] = true;
		for (const [to, from] of Object.entries(d.renamed || {})) if (this.keys.includes(to) && !this.keys.includes(from)) this.renamed[to] = from;
	}
}
