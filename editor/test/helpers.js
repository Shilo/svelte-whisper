import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';

// doc.svelte.js uses runes, so it is compiled the way Vite would compile it, next to the
// tests so that `svelte` resolves to the editor's copy. Run with --conditions=browser.
const lib = join(import.meta.dirname, '..', 'src', 'lib');
const dir = join(import.meta.dirname, '.build');
mkdirSync(dir, { recursive: true });
const built = join(dir, `doc.${process.pid}.js`);
const code = compileModule(readFileSync(join(lib, 'doc.svelte.js'), 'utf8'), {
	generate: 'client',
	filename: 'doc.svelte.js'
}).js.code.replace(/from '\.\/([\w.-]+)'/g, (_, file) => `from '${pathToFileURL(join(lib, file)).href}'`);
writeFileSync(built, code);
process.on('exit', () => rmSync(built, { force: true }));

/** @type {typeof import('../src/lib/doc.svelte.js')} */
export const { LocaleDoc } = await import(pathToFileURL(built).href);

/**
 * A document from plain objects or raw text, one entry per language.
 * @param {Record<string, object | string>} files
 * @param {string} [version]  added to every file's SHA, to stand for a later version of the files
 */
export function makeDoc(files, source = 'en', version = '') {
	const list = Object.entries(files).map(([lang, data]) => ({
		name: `${lang}.json`,
		path: `src/locales/${lang}.json`,
		sha: `sha-${lang}${version}`,
		text: typeof data === 'string' ? data : JSON.stringify(data, null, '\t') + '\n'
	}));
	return new LocaleDoc(list, 'src/locales', source);
}

/** The text that would be sent for one language, or undefined when it is unchanged. */
export const output = (doc, lang) => doc.outputFiles().find((f) => f.lang === lang)?.text;
