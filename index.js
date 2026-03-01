import { writable, derived } from 'svelte/store';

const currentLocale = writable('');
const fallbackLocale = writable('en');
const dictionaries = writable({});
const loaders = {};

export function init(options = {}) {
    if (options.fallback) fallbackLocale.set(options.fallback);
    if (options.initial) setLocale(options.initial);
}

export function addDictionary(locale, dict) {
    dictionaries.update(d => {
        d[locale] = { ...d[locale], ...dict };
        return d;
    });
}

export function registerLoader(locale, loader) {
    loaders[locale] = loader;
}

export async function setLocale(locale) {
    let dictStore = {};
    const unsubscribe = dictionaries.subscribe(v => dictStore = v);
    unsubscribe();

    if (!dictStore[locale] && loaders[locale]) {
        try {
            const module = await loaders[locale]();
            const dict = module.default || module;
            addDictionary(locale, dict);
        } catch (e) {
            console.error(`svelte-whisper: Failed to load dictionary for ${locale}`, e);
        }
    }
    currentLocale.set(locale);
}

export const locale = {
    subscribe: currentLocale.subscribe,
    set: setLocale
};

function resolveKey(dict, key) {
    if (!dict) return undefined;
    const keys = key.split('.');
    let val = dict;
    for (const k of keys) {
        if (val === undefined || val === null) return undefined;
        val = val[k];
    }
    return val;
}

function interpolate(text, vars) {
    if (!text || typeof text !== 'string') return text;
    if (!vars) return text;

    return text.replace(/{([^}]+)}/g, (match, p1) => {
        const key = p1.trim();
        return vars[key] !== undefined ? String(vars[key]) : match;
    });
}

export const t = derived(
    [currentLocale, dictionaries, fallbackLocale],
    ([$currentLocale, $dictionaries, $fallbackLocale]) => {
        return (key, vars) => {
            const currentDict = $dictionaries[$currentLocale];
            let val = resolveKey(currentDict, key);

            if (val === undefined && $currentLocale !== $fallbackLocale) {
                const fallbackDict = $dictionaries[$fallbackLocale];
                val = resolveKey(fallbackDict, key);
            }

            if (val === undefined) return key;
            return interpolate(val, vars);
        };
    }
);
