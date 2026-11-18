// Micro-benchmarks for the hot paths. Run: npm run bench [-- path/to/other/index.js]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const target = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : '../index.js';
const w = await import(target);

w.addDictionary('en', {
    hello: 'Hello',
    app: { settings: { title: 'Settings' } },
    greeting: 'Hello {user}, you have {count} new messages.',
    items: { one: '{count} item', other: '{count} items' },
});
w.addDictionary('fr', { hello: 'Bonjour' });
await w.init({ fallback: 'en', initial: 'en', detect: false, warn: false, devOverlay: false });

let translate;
w.t.subscribe(fn => { translate = fn; })();

const cases = {
    'flat key': () => translate('hello'),
    'nested key': () => translate('app.settings.title'),
    'missing key': () => translate('app.settings.nope'),
    'interpolation': () => translate('greeting', { user: 'Ada', count: 3 }),
    'plural': () => translate('items', { count: 3 }),
    'tr()': () => w.tr('hello'),
    'formatNumber': () => w.formatNumber(1234567.891),
};

let sink = 0;
console.log(`svelte-whisper benchmark — ${target}\n`);
for (const [name, fn] of Object.entries(cases)) {
    try {
        for (let i = 0; i < 200_000; i++) sink += fn().length; // warm up
        const iterations = 2_000_000;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) sink += fn().length;
        const ms = performance.now() - start;
        const ops = Math.round(iterations / (ms / 1000));
        console.log(`${name.padEnd(16)} ${ops.toLocaleString('en').padStart(13)} ops/s  ${(ms * 1e6 / iterations).toFixed(1).padStart(7)} ns/op`);
    } catch (e) {
        console.log(`${name.padEnd(16)} not supported (${e.message})`);
    }
}

await w.setLocale('fr');
const switches = 20_000;
const start = performance.now();
for (let i = 0; i < switches; i++) await w.setLocale(i % 2 ? 'fr' : 'en');
const ms = performance.now() - start;
console.log(`${'locale switch'.padEnd(16)} ${Math.round(switches / (ms / 1000)).toLocaleString('en').padStart(13)} ops/s  ${(ms * 1e6 / switches).toFixed(1).padStart(7)} ns/op`);
if (sink < 0) console.log(sink);
