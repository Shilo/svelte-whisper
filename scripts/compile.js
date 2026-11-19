// The library is a Svelte runes module (index.svelte.js). Apps compile it with their own Svelte
// plugin; the tests, the benchmark and the size report compile it here.
import { compileModule } from 'svelte/compiler';
import { readFileSync } from 'node:fs';

const source = new URL('../index.svelte.js', import.meta.url);

/**
 * `prepare` stands for a tool that rewrites the source before the Svelte plugin sees it.
 * @param {{ generate?: 'client' | 'server', dev?: boolean, prepare?: (source: string) => string }} [options]
 */
export function compile({ generate = 'client', dev = false, prepare = source => source } = {}) {
    return compileModule(prepare(readFileSync(source, 'utf8')), { generate, dev, filename: 'index.svelte.js' }).js.code;
}
