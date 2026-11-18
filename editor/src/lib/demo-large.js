// A synthetic large set for checking performance at /?demo=large in development.
// Imported only by the dev server, so production builds leave it out.

/**
 * `count` keys in 5 languages, nested three levels deep, with gaps.
 * @param {number} count
 */
export function largeDemoFiles(count = 3000) {
	const langs = ['en', 'de', 'es', 'fr', 'ja'];
	return langs.map((lang, li) => {
		/** @type {Record<string, any>} */
		const data = {};
		for (let i = 0; i < count; i++) {
			if (li && (i * 7 + li * 13) % 11 === 0) continue; // leave gaps
			const group = (data[`section${i % 30}`] ??= {});
			const sub = (group[`group${i % 7}`] ??= {});
			sub[`item${i}`] = `${lang.toUpperCase()} string ${i} for {name}`;
		}
		return { name: `${lang}.json`, path: `src/locales/${lang}.json`, sha: `large-${lang}`, text: JSON.stringify(data, null, '\t') + '\n' };
	});
}
