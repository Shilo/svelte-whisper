import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { flushSync } from 'svelte';
import { compile } from '../scripts/compile.js';

// Compiled once per test process, next to the tests so `svelte` resolves to this project's copy.
const dir = join(import.meta.dirname, '.build');
mkdirSync(dir, { recursive: true });
const built = name => join(dir, `${name}.${process.pid}.js`);
const files = [];
const emit = (name, code) => {
    const file = built(name);
    writeFileSync(file, code);
    files.push(file);
    return pathToFileURL(file).href;
};
const whisper = emit('whisper', compile());
const runes = await import(emit('runes', compileModule(`
    export function watch(fn) {
        return $effect.root(() => {
            $effect(() => { fn(); });
        });
    }
    export function derive(fn) {
        const value = $derived.by(fn);
        return () => value;
    }
`, { generate: 'client', filename: 'runes.svelte.js' }).js.code));
process.on('exit', () => { for (const file of files) rmSync(file, { force: true }); });

let instance = 0;

/**
 * A fresh, isolated copy of the library: its state is module-level, so every test gets its own.
 * With `options`, the copy is compiled with them (see scripts/compile.js) instead.
 */
export function load(options) {
    const url = options ? emit(`whisper-${instance + 1}`, compile(options)) : whisper;
    return import(`${url}?instance=${++instance}`);
}

/**
 * Run `fn` in a real Svelte effect and record what it returns each time it runs.
 * Returns `{ seen, flush, stop }`.
 */
export function observe(fn) {
    const seen = [];
    const stop = runes.watch(() => { seen.push(fn()); });
    flushSync();
    return { seen, flush: flushSync, stop };
}

export const derive = runes.derive;

/**
 * Replace browser globals for the duration of `fn`, then restore them.
 * Pass `undefined` for a key to remove that global.
 */
export async function withGlobals(globals, fn) {
    const saved = {};
    for (const [name, value] of Object.entries(globals)) {
        saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    }
    try {
        return await fn();
    } finally {
        for (const [name, descriptor] of Object.entries(saved)) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
}

export const browser = (...languages) => ({ languages, language: languages[0] });

export function storage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: key => data[key] ?? null,
        setItem: (key, value) => { data[key] = String(value); },
        removeItem: key => { delete data[key]; },
    };
}

/** A promise that the test resolves by hand, for ordering async loaders. */
export function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

/** Silence and record console output for the duration of `fn`. */
export async function captureConsole(method, fn) {
    const original = console[method];
    const calls = [];
    console[method] = (...args) => { calls.push(args); };
    try {
        await fn(calls);
    } finally {
        console[method] = original;
    }
    return calls;
}
