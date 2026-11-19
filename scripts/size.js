// Reports what svelte-whisper adds to a production bundle, and fails when it outgrows its budget.
// Run: npm run size
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { compile } from './compile.js';

// Gzipped bytes. Raise deliberately, never by accident.
const BUDGET = { typical: 1800, everything: 2000 };

const entries = {
    // What a typical app imports. Everything else is tree-shaken away.
    typical: `export { init, t, getLocale, setLocale, registerLoader } from 'whisper';`,
    everything: `export * from 'whisper';`,
};

// The module as an app's Svelte plugin compiles it for production.
const compiled = {
    name: 'compiled-whisper',
    setup(build) {
        build.onResolve({ filter: /^whisper$/ }, () => ({ path: 'whisper', namespace: 'whisper' }));
        build.onLoad({ filter: /.*/, namespace: 'whisper' }, () => ({ contents: compile(), resolveDir: process.cwd() }));
    },
};

let failed = false;
console.log('svelte-whisper bundle size (compiled, minified, production build)\n');

for (const [name, contents] of Object.entries(entries)) {
    const result = await build({
        stdin: { contents, resolveDir: process.cwd() },
        plugins: [compiled],
        bundle: true,
        minify: true,
        format: 'esm',
        write: false,
        // Svelte's runtime is already in every Svelte app, so it is not counted here.
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
