import { writable, derived } from 'svelte/store';

const currentLocale = writable('');
const fallbackLocale = writable('en');
const dictionaries = writable({});
const loaders = {};

let dictionariesVal = {};
dictionaries.subscribe(v => dictionariesVal = v);

export async function init(options = {}) {
    if (options.fallback) fallbackLocale.set(options.fallback);
    if (options.initial) await setLocale(options.initial);
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
    if (!dictionariesVal[locale]) {
        try {
            let dict;
            if (loaders[locale]) {
                const module = await loaders[locale]();
                dict = module.default || module;
            } else if (typeof fetch !== 'undefined') {
                // Zero-Config Auto Fallback
                const res = await fetch(`/locales/${locale}.json`);
                if (res.ok) dict = await res.json();
            }
            if (dict) addDictionary(locale, dict);
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

const keyCache = new Map();

function resolveKey(dict, key) {
    if (!dict) return undefined;
    if (dict[key] !== undefined) return dict[key]; // Fast path for flat keys

    let keys = keyCache.get(key);
    if (!keys) {
        keys = key.split('.');
        keyCache.set(key, keys);
    }

    let val = dict;
    for (let i = 0; i < keys.length; i++) {
        val = val[keys[i]];
        if (val == null) return undefined;
    }
    return val;
}

function interpolate(text, vars) {
    if (!text || typeof text !== 'string') return text;
    if (!vars || text.indexOf('{') === -1) return text;

    let autoIndex = 0;
    return text.replace(/{([^}]*)}/g, (match, p1) => {
        let key = p1.trim() || autoIndex++;
        return vars[key] !== undefined ? String(vars[key]) : match;
    });
}

export const t = derived(
    [currentLocale, dictionaries, fallbackLocale],
    ([$currentLocale, $dictionaries, $fallbackLocale]) => {
        return (key, vars) => {
            let val = resolveKey($dictionaries[$currentLocale], key);

            if (val === undefined && $currentLocale !== $fallbackLocale) {
                val = resolveKey($dictionaries[$fallbackLocale], key);
            }

            if (val === undefined) return key;
            return interpolate(val, vars);
        };
    }
);
