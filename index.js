import { writable, derived, get } from 'svelte/store';

const currentLocale = writable('');
const fallbackLocale = writable('en');
const dictionaries = writable({});
const loaders = {};

let dictionariesVal = {};
dictionaries.subscribe(v => dictionariesVal = v);

let persistKey = null;
let persistUnsub = null;
let initOptions = {};
const keyCache = new Map();

// --- Public API ---

export async function init(options = {}) {
    initOptions = options;
    if (options.fallback) fallbackLocale.set(options.fallback);

    // Clean up previous persistence
    if (persistUnsub) {
        persistUnsub();
        persistUnsub = null;
    }
    persistKey = null;

    // Determine initial locale: persist → detect → initial → fallback
    let initial = '';

    if (options.persistKey && typeof localStorage !== 'undefined') {
        persistKey = options.persistKey;
        try {
            const stored = localStorage.getItem(persistKey);
            if (stored && (loaders[stored] || dictionariesVal[stored])) {
                initial = stored;
            }
        } catch { }
    }

    if (!initial && options.detect !== false) {
        const mapping = typeof options.detect === 'object' ? options.detect : null;
        initial = detectBrowserLocale(mapping, '');
    }

    if (!initial && options.initial) {
        initial = options.initial;
    }

    if (!initial) {
        initial = options.fallback || get(fallbackLocale) || '';
    }

    if (initial) await setLocale(initial);

    // Persist only FUTURE explicit locale changes (not the auto-detected initial value)
    setupPersistence();
}

export async function resetLocale() {
    if (persistKey && typeof localStorage !== 'undefined') {
        try { localStorage.removeItem(persistKey); } catch { }
    }

    // Tear down persistence so re-detected locale isn't stored
    if (persistUnsub) { persistUnsub(); persistUnsub = null; }

    let next = '';

    if (initOptions.detect !== false) {
        const mapping = typeof initOptions.detect === 'object' ? initOptions.detect : null;
        next = detectBrowserLocale(mapping, '');
    }

    if (!next && initOptions.initial) {
        next = initOptions.initial;
    }

    if (!next) {
        next = initOptions.fallback || get(fallbackLocale) || '';
    }

    if (next) await setLocale(next);

    // Re-establish persistence for future explicit changes only
    setupPersistence();
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

export function getLocales() {
    return [...new Set([...Object.keys(loaders), ...Object.keys(dictionariesVal)])];
}

export function getFallbackLocale() {
    return get(fallbackLocale);
}

export const locale = {
    subscribe: currentLocale.subscribe,
    set: setLocale
};

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

export function tr(key, vars) {
    return get(t)(key, vars);
}

export function formatNumber(num) {
    return num.toLocaleString(get(currentLocale) || undefined);
}

export function formatPercent(decimal, precision = 0) {
    if (decimal === 0) return '0%';
    const percent = decimal * 100;
    if (Number.isInteger(percent)) return formatNumber(percent) + '%';
    return String(parseFloat(percent.toFixed(precision))) + '%';
}

// --- Internal helpers ---

function setupPersistence() {
    if (persistUnsub) { persistUnsub(); persistUnsub = null; }
    if (!persistKey) return;
    let skip = true;
    persistUnsub = currentLocale.subscribe(val => {
        if (skip) { skip = false; return; }
        if (val) {
            try { localStorage.setItem(persistKey, val); } catch { }
        }
    });
}

function detectBrowserLocale(mapping, fallback) {
    if (typeof navigator === 'undefined') return fallback || '';
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];

    // Explicit mapping: { prefix: localeId }
    if (mapping) {
        for (const lang of langs) {
            const lower = lang.toLowerCase();
            for (const [prefix, loc] of Object.entries(mapping)) {
                if (lower.startsWith(prefix.toLowerCase())) return loc;
            }
        }
        return fallback || '';
    }

    // Auto-detect: iterate browser language preferences in priority order
    const knownLocales = [...new Set([...Object.keys(loaders), ...Object.keys(dictionariesVal)])];
    for (const lang of langs) {
        const lower = lang.toLowerCase();
        // Exact match first (e.g. "ja-JP" matches registered "ja-JP")
        const exact = knownLocales.find(l => lower === l.toLowerCase());
        if (exact) return exact;
        // Prefix match (e.g. "ja-JP" matches registered "ja")
        const prefix = knownLocales.find(l => lower.startsWith(l.toLowerCase()));
        if (prefix) return prefix;
    }
    return fallback || '';
}

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
