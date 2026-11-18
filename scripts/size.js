// Reports what svelte-whisper adds to a production bundle, and fails when it outgrows its budget.
// Run: npm run size
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';

// Gzipped bytes. Raise deliberately, never by accident.
const BUDGET = { typical: 1750, everything: 1950 };

const entries = {
    // What a typical app imports. Everything else is tree-shaken away.
    typical: `export { init, t, tr, locale, registerLoader, addDictionary } from './index.js';`,
    everything: `export * from './index.js';`,
};

let failed = false;
console.log('svelte-whisper bundle size (minified, production build)\n');

for (const [name, contents] of Object.entries(entries)) {
    const result = await build({
        stdin: { contents, resolveDir: process.cwd() },
        bundle: true,
        minify: true,
        format: 'esm',
        write: false,
        external: ['svelte', 'svelte/*'],
        // What Vite substitutes in a production build; this removes the dev overlay branch.
        define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"' },
    });
    const code = result.outputFiles[0].contents;
    const gzip = gzipSync(code, { level: 9 }).length;
    const brotli = brotliCompressSync(code).length;
    const over = gzip > BUDGET[name];
    failed ||= over;
    console.log(
        `${name.padEnd(11)} ${String(code.length).padStart(5)} B min  ${String(gzip).padStart(5)} B gzip  ` +
        `${String(brotli).padStart(5)} B brotli  budget ${BUDGET[name]} B gzip ${over ? '✖ over budget' : '✔'}`,
    );
}

if (failed) process.exit(1);
