// Language names come from the browser (Intl.DisplayNames), so the editor
// ships no language table of its own.

/**
 * A locale file is named like a language tag: en, pt-BR, zh-Hant, sr-Latn-RS.
 * The same pattern as the svelte-whisper command line tool, so both agree on
 * which files are locales (tsconfig.json and notes.json are not).
 */
export const LANG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** @param {string} name  a file name such as "pt-BR.json" */
export const isLocaleFile = (name) => name.endsWith('.json') && LANG_PATTERN.test(name.slice(0, -5));

/** @type {Intl.DisplayNames | null} */
let names = null;
try {
	names = new Intl.DisplayNames(['en'], { type: 'language' });
} catch {
	names = null;
}

/** @type {Map<string, string>} */
const cache = new Map();

/**
 * "pt-BR" -> "Brazilian Portuguese"; unknown codes come back unchanged.
 * @param {string} code
 */
export function languageName(code) {
	let name = cache.get(code);
	if (name === undefined) {
		try {
			name = names?.of(code) ?? code;
		} catch {
			name = code;
		}
		cache.set(code, name);
	}
	return name;
}
