let instance = 0;

/** A fresh, isolated copy of the library: its state is module-level, so every test gets its own. */
export const load = () => import(`../index.js?instance=${++instance}`);

/** Read a store's current value without importing svelte/store. */
export function read(store) {
    let value;
    store.subscribe(v => { value = v; })();
    return value;
}

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
