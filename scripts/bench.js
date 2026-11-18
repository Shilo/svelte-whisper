// Micro-benchmarks for the hot paths, run against the compiled module. Run: npm run bench
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from './compile.js';

const dir = join(import.meta.dirname, '../test/.build');
const file = join(dir, `bench.${process.pid}.js`);
mkdirSync(dir, { recursive: true });
writeFileSync(file, compile());
process.on('exit', () => rmSync(file, { force: true }));
const w = await import(pathToFileURL(file).href);

// A dictionary the size of a real app's: 28 groups, 600 messages.
const dictionary = {};
const keys = [];
for (let i = 0; i < 600; i++) {
    (dictionary[`group${i % 28}`] ??= {})[`message${i}`] = `Message ${i}`;
    keys.push(`group${i % 28}.message${i}`);
}
w.addDictionary('en', {
    ...dictionary,
    hello: 'Hello',
    greeting: 'Hello {user}, you have {count} new messages.',
    items: { one: '{count} item', other: '{count} items' },
});
w.addDictionary('fr', { hello: 'Bonjour' });
await w.init({ fallback: 'en', initial: 'en', detect: false, warn: false, devOverlay: false });

let i = 0;
const cases = {
    'one key, repeated': () => w.t('hello'),
    '600 nested keys': () => w.t(keys[i++ % 600]),
    'missing key': () => w.t('group1.nope'),
    'interpolation': () => w.t('greeting', { user: 'Ada', count: 3 }),
    'plural': () => w.t('items', { count: 3 }),
    'formatNumber': () => w.formatNumber(1234567.891),
};

let sink = 0;
console.log('svelte-whisper benchmark\n');
for (const [name, fn] of Object.entries(cases)) {
    for (let n = 0; n < 200_000; n++) sink += fn().length; // warm up
    const iterations = 2_000_000;
    const start = performance.now();
    for (let n = 0; n < iterations; n++) sink += fn().length;
    const ms = performance.now() - start;
    const ops = Math.round(iterations / (ms / 1000));
    console.log(`${name.padEnd(18)} ${ops.toLocaleString('en').padStart(13)} ops/s  ${(ms * 1e6 / iterations).toFixed(1).padStart(7)} ns/op`);
}

const switches = 20_000;
const start = performance.now();
for (let n = 0; n < switches; n++) await w.setLocale(n % 2 ? 'fr' : 'en');
const ms = performance.now() - start;
console.log(`${'locale switch'.padEnd(18)} ${Math.round(switches / (ms / 1000)).toLocaleString('en').padStart(13)} ops/s  ${(ms * 1e6 / switches).toFixed(1).padStart(7)} ns/op`);
if (sink < 0) console.log(sink);
