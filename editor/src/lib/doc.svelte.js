// The editable document: every locale file of one folder, flattened to dotted
// keys, plus the user's edits. Edits are always derived by comparing the
// current values with what was loaded, so undoing an edit by hand clears it.

import { parseFile, flatten, serialize, comparePlaceholders } from './json.js';
import { LANG_PATTERN } from './lang.js';

/** @typedef {{ name: string, path: string, sha: string | null, text: string }} SourceFile */
/** @typedef {{ key: string, before: string | undefined, after: string | undefined }} Change */
/** @typedef {{ lang: string, path: string, sha: string | null, isNew: boolean, changes: Change[], text: string }} OutFile */

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
	/** @type {Record<string, Set<string>>} keys whose value is null: "not translated yet" */
	empty = {};
	/** Every key that some file has, in any form. */
	known = new Set();
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
		/** @type {Record<string, string[]>} */
		const fileKeys = {};
		/** @type {Record<string, string[]>} */
		const fileGroups = {};
		for (const f of list) {
			const lang = f.name.replace(/\.json$/i, '');
			let parsed;
			try {
				parsed = parseFile(f.text);
			} catch (e) {
				throw new Error(`${f.name} is not valid JSON (${e.message}). Fix it in the repository first.`);
			}
			let flat;
			try {
				flat = flatten(parsed.data);
			} catch (e) {
				throw new Error(`${f.name} ${e.message}. Fix it in the repository first.`);
			}
			const { strings, other, empty, keys, groups } = flat;
			this.files[lang] = { path: f.path, sha: f.sha, parsed };
			this.base[lang] = strings;
			this.fixed[lang] = other;
			this.empty[lang] = new Set(empty);
			values[lang] = { ...strings };
			fileKeys[lang] = keys;
			fileGroups[lang] = groups;
		}
		const langs = Object.keys(values).sort();
		const source = langs.includes(preferredSource) ? preferredSource : langs.includes('en') ? 'en' : langs[0] || '';
		// Key order follows the source file, then anything only other files have.
		for (const lang of [source, ...langs]) {
			for (const k of fileKeys[lang] ?? []) {
				if (!seen.has(k)) seen.add(k), order.push(k);
			}
		}
		// A name that is a message in one file and a group in another is read-only where it
		// is a group: text written there would replace the group and every message in it.
		for (const lang of langs) {
			for (const g of fileGroups[lang]) if (seen.has(g) && !fileKeys[lang].includes(g)) this.fixed[lang][g] = '{…}';
		}
		this.known = seen;
		this.source = source;
		this.langs = [source, ...langs.filter((l) => l !== source)].filter(Boolean);
		this.keys = order;
		this.values = values;
	}

	/** @param {string} lang @param {string} key */
	isFixed(lang, key) {
		return this.fixed[lang]?.[key] !== undefined;
	}

	/** True when some file holds a non-string value for the key: it cannot be renamed or deleted here. */
	/** @param {string} key */
	isFixedKey(key) {
		return this.langs.some((l) => this.isFixed(l, key));
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

	/** Names in the files that a rename in this session moved away from. */
	#renamedFrom = $derived(new Set(Object.values(this.renamed)));

	/**
	 * True when the key is new in this session: no file has it, or the files' row of that
	 * name was renamed away and this is a new row that took the free name.
	 * @param {string} key
	 */
	isNewKey(key) {
		return !this.renamed[key] && (!this.known.has(key) || this.#renamedFrom.has(key));
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
		if (i === -1 || from === to || this.isFixedKey(from)) return;
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
		if (this.isFixedKey(key)) return;
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
		this.empty[lang] = new Set();
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
			const empty = this.empty[lang];
			for (const k of this.keys) {
				if (this.isFixed(lang, k)) continue;
				const before = base[k];
				const after = this.deleted[k] ? undefined : cur[k];
				if (before !== after) e[k] = after ?? null;
				else if (this.deleted[k] && empty.has(k)) e[k] = null; // a deleted key loses its null too
			}
			// Keys renamed away disappear from this.keys entirely.
			for (const k of [...Object.keys(base), ...empty]) if (!live.has(k)) e[k] = null;
			const isNew = this.files[lang].sha === null && !this.files[lang].parsed;
			if (Object.keys(e).length || isNew) out[lang] = e;
		}
		return out;
	}

	/** Count of changed cells, for the status bar. */
	changeCount() {
		return this.#changeCount;
	}

	/**
	 * Renamed keys that were `null` ("not translated yet") in a language's file and still
	 * have no text there: the `null` moves with the key, so the file keeps saying so.
	 * @param {string} lang
	 */
	movedNulls(lang) {
		return this.keys.filter((k) => {
			const from = this.renamed[k];
			return from && !this.deleted[k] && this.empty[lang].has(from) && this.values[lang][k] === undefined;
		});
	}

	/** @returns {OutFile[]} */
	outputFiles() {
		const sourceNested = this.files[this.source]?.parsed?.nested ?? false;
		return Object.entries(this.edits()).map(([lang, e]) => {
			const f = this.files[lang];
			const nulls = this.movedNulls(lang);
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
				text: serialize(f.parsed, e, { nested: sourceNested, order: this.keys, nulls })
			};
		});
	}


	/** The text the files have for a row: under the name it had there before any rename. */
	/** @param {string} lang @param {string} key */
	#fileText(lang, key) {
		return this.base[lang]?.[this.renamed[key] ?? key];
	}

	/**
	 * The working state for the local draft, compact and JSON-safe, with the version of
	 * every file it was made against. `cells` holds only the boxes whose text differs from
	 * what the file has for that row, deleted rows included, so a restore after a reload
	 * gives the same text as before it.
	 * @returns {Draft}
	 */
	toDraft() {
		/** @type {Draft['shas']} */
		const shas = {};
		/** @type {Draft['cells']} */
		const cells = {};
		for (const lang of this.langs) {
			shas[lang] = this.files[lang].parsed ? this.files[lang].sha : null;
			const row = this.values[lang];
			/** @type {Record<string, string | null>} */
			const c = {};
			for (const k of this.keys) {
				const text = row[k] ?? null;
				if (text !== (this.#fileText(lang, k) ?? null)) c[k] = text;
			}
			if (Object.keys(c).length) cells[lang] = c;
		}
		return {
			shas,
			langs: [...this.langs],
			keys: [...this.keys],
			renamed: { ...this.renamed },
			deleted: Object.keys(this.deleted),
			added: this.keys.filter((k) => this.isNewKey(k)),
			cells
		};
	}

	/**
	 * Restore a draft on a freshly loaded document. When the files are the ones the draft
	 * was made against, the state is rebuilt exactly. When they changed on GitHub since,
	 * as much as possible is placed and the rest is returned, so it can be reported.
	 * A draft in an older format is ignored.
	 * @param {Draft} d
	 * @returns {Lost[]} what could not be restored
	 */
	applyDraft(d) {
		if (!d || !Array.isArray(d.keys) || !Array.isArray(d.langs) || !d.shas) return [];
		const loaded = Object.keys(this.files);
		const same =
			d.langs.length === Object.keys(d.shas).length &&
			d.langs.every((l) => (d.shas[l] === null ? !this.files[l] && LANG_PATTERN.test(l) : this.files[l]?.sha === d.shas[l])) &&
			loaded.every((l) => d.shas[l] !== undefined);
		return same ? this.#restore(d) : this.#merge(d);
	}

	/** @param {Draft} d */
	#restore(d) {
		for (const lang of d.langs) if (d.shas[lang] === null) this.addLanguage(lang);
		this.langs = [...d.langs];
		this.source = d.langs[0] ?? '';
		this.keys = [...d.keys];
		this.renamed = { ...d.renamed };
		this.deleted = Object.fromEntries(d.deleted.map((k) => [k, true]));
		for (const lang of this.langs) {
			const cells = d.cells[lang] ?? {};
			/** @type {Record<string, string>} */
			const row = {};
			for (const k of this.keys) {
				const text = Object.hasOwn(cells, k) ? cells[k] : this.#fileText(lang, k);
				if (typeof text === 'string') row[k] = text;
			}
			this.values[lang] = row;
		}
		return [];
	}

	/**
	 * Best effort for files that changed since the draft was saved: languages, renames,
	 * added keys, text, then deletions. Nothing of someone else's is overwritten.
	 * @param {Draft} d
	 */
	#merge(d) {
		/** @type {Lost[]} */
		const lost = [];
		for (const lang of d.langs) if (d.shas[lang] === null && LANG_PATTERN.test(lang)) this.addLanguage(lang);
		if (d.langs[0] && d.langs[0] !== this.source) this.setSource(d.langs[0]);

		// Renames are applied all at once, so a chain (x to y, then a to x) and a swap work. A
		// rename needs its source and a target that is free or itself moving away; dropping
		// one can block another, so filter until nothing changes.
		const all = Object.entries(d.renamed).filter(([to, from]) => to !== from);
		let renames = all.filter(([, from]) => this.keys.includes(from) && !this.isFixedKey(from));
		for (let n = -1; n !== renames.length; ) {
			n = renames.length;
			const moving = new Set(renames.map(([, from]) => from));
			const after = [...this.keys.filter((k) => !moving.has(k)), ...renames.map(([to]) => to)];
			renames = renames.filter(
				([to]) => (!this.keys.includes(to) || moving.has(to)) && !after.some((k) => k.startsWith(to + '.') || to.startsWith(k + '.'))
			);
		}
		const target = new Map(renames.map(([to, from]) => [from, to]));
		this.keys = this.keys.map((k) => target.get(k) ?? k);
		for (const lang of this.langs) {
			const row = this.values[lang];
			const moved = renames.map(([to, from]) => [to, row[from]]);
			for (const [, from] of renames) delete row[from];
			for (const [to, text] of moved) if (text !== undefined) row[to] = text;
		}
		for (const [to, from] of renames) this.renamed[to] = from;

		// Where each key of the draft lives now. A row takes the text of one key only.
		/** @type {Map<string, string>} */
		const rows = new Map();
		const taken = new Set();
		const claim = (/** @type {string} */ key, /** @type {string} */ row) => {
			if (taken.has(row)) return false;
			taken.add(row);
			rows.set(key, row);
			return true;
		};
		for (const [to, from] of all) {
			if (target.get(from) === to) claim(to, to);
			else {
				lost.push({ key: from, to });
				// The row stays under its name in the files, and keeps the text typed into it.
				if (this.keys.includes(from)) claim(to, from);
			}
		}
		const added = new Set(d.added);
		for (const k of d.keys) {
			if (rows.has(k) || d.renamed[k] !== undefined) continue;
			const exists = this.keys.includes(k);
			if (!added.has(k)) {
				if (exists) claim(k, k);
				continue;
			}
			// A new key that now exists upstream takes the user's text: it shows in the review.
			if (!exists && !this.validateKey(k)) this.addKey(k);
			if (!this.keys.includes(k) || !claim(k, k)) lost.push({ key: k });
		}

		for (const [lang, cells] of Object.entries(d.cells)) {
			for (const [k, text] of Object.entries(cells)) {
				const row = rows.get(k);
				if (row === undefined || !this.values[lang] || this.isFixed(lang, row)) lost.push({ key: k, lang });
				else if (text === null) delete this.values[lang][row];
				else this.values[lang][row] = text;
			}
		}
		for (const k of d.deleted) {
			const row = rows.get(k);
			if (row !== undefined && !this.isFixedKey(row) && !this.isNewKey(row)) this.deleted[row] = true;
		}
		return lost;
	}
}

/**
 * @typedef {{
 *   shas: Record<string, string | null>, langs: string[], keys: string[], renamed: Record<string, string>,
 *   deleted: string[], added: string[], cells: Record<string, Record<string, string | null>>
 * }} Draft
 * `shas`: each language's file as loaded, null for a language added in the editor.
 * `langs`: every column in order, the source language first.
 */
/**
 * @typedef {{ key: string, lang?: string, to?: string }} Lost
 * A draft box that has no row any more (`lang` set), a rename that could not be applied
 * (`to` set), or a new key whose name is taken (neither).
 */
