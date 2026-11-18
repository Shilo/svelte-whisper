// Language names come from the browser (Intl.DisplayNames), so the editor
// ships no language table of its own.

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
 * "pt_BR" -> "Brazilian Portuguese"; unknown codes come back unchanged.
 * @param {string} code
 */
export function languageName(code) {
	let name = cache.get(code);
	if (name === undefined) {
		try {
			name = names?.of(code.replace(/_/g, '-')) ?? code;
		} catch {
			name = code;
		}
		cache.set(code, name);
	}
	return name;
}
