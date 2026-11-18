// svelte-whisper — tiny runtime i18n for Svelte 5 single-page apps.
import { createSubscriber } from 'svelte/reactivity';

const RTL = /^(ar|ckb|dv|fa|he|ps|sd|ug|ur|yi)\b/i;

// Dictionaries are stored flattened, so `a.b.c` is a single property lookup.
const dictionaries = {};
const loaders = {};
const pending = {};
const formatters = {};
const missingListeners = new Set();
const localeSubscribers = new Set();
const tSubscribers = new Set();

let current = '';
let fallback = 'en';
let options = {};
let warn = true;
let request = 0;
let fallbackTried = false;
let missing = {};
let active, backup, tFn;

// Vite replaces import.meta.env.* at build time; elsewhere the lookup throws and '/' stays.
let base = '/';
try { base = import.meta.env.BASE_URL || base; } catch { }

// Lets plain function calls (tr, formatNumber, …) re-run inside Svelte 5 templates,
// $derived and $effect when the locale or a dictionary changes. A no-op elsewhere.
let ping = () => { };
const track = createSubscriber(update => { ping = update; });

refresh();

// --- Setup ---

export async function init(opts = {}) {
    options = opts;
    fallback = opts.fallback || fallback;
    warn = opts.warn ?? !opts.onMissing;
    fallbackTried = false;
    missing = {};
    refresh();
    await pick(persisted('getItem'));

    // Dev overlay: a separate chunk, requested only by the Vite dev server.
    // In production builds this whole branch is removed.
    try {
        if (import.meta.env.DEV && opts.devOverlay !== false && !navigator.webdriver) {
            import('./dev-overlay.js').then(m => m.mount({
                keys: () => Object.keys(missing).flatMap(locale => [...missing[locale]].map(key => ({ locale, key }))),
                listen: fn => missingListeners.add(fn),
                clear() { missing = {}; },
            }));
        }
    } catch { }
}

export function addDictionary(locale, dict) {
    flatten(dict, '', dictionaries[locale] ??= Object.create(null));
    if (locale === current || locale === fallback) refresh();
}

/**
 * registerLoader('es', () => import('./locales/es.json'))
 * registerLoader(import.meta.glob('./locales/*.json'))
 */
export function registerLoader(locale, loader) {
    if (loader) loaders[locale] = loader;
    else if (typeof locale === 'object') {
        for (const path in locale) loaders[path.replace(/^.*\/|\.[^.]*$/g, '')] = locale[path];
    }
}

export function loadLocale(locale) {
    if (dictionaries[locale]) return Promise.resolve(true);
    return pending[locale] ??= (async () => {
        let dict;
        try {
            if (loaders[locale]) {
                dict = await loaders[locale]();
                if (dict && typeof dict.default === 'object') dict = dict.default;
            } else if (!Object.keys(loaders).length) {
                // Zero-config: with no loaders registered, locales are fetched by convention.
                const response = await fetch(`${base}locales/${locale}.json`);
                if (response.ok) dict = await response.json();
            }
        } catch (error) {
            console.error(`svelte-whisper: Failed to load locale "${locale}"`, error);
        }
        delete pending[locale];
        if (dict) addDictionary(locale, dict);
        return !!dict;
    })();
}

// --- Locale ---

/** Resolves true once `locale` is active, false if it could not be loaded or a newer call won. */
export function setLocale(locale) {
    return change(locale, true).then(Boolean);
}

export function resetLocale() {
    persisted('removeItem');
    return pick();
}

export function getLocale() {
    track();
    return current;
}

export function getLocales() {
    return Object.keys({ ...loaders, ...dictionaries });
}

export function getFallbackLocale() {
    return fallback;
}

/** Best match for the browser's preferred languages among known locales, or ''. */
export function detectLocale(mapping) {
    if (typeof navigator === 'undefined') return '';
    const known = mapping ? Object.keys(mapping) : getLocales();
    for (const language of [...navigator.languages || [], navigator.language || '']) {
        const lang = language.toLowerCase();
        for (const matches of [
            tag => tag === lang,                                    // ja-JP → ja-JP
            tag => lang.startsWith(tag + '-'),                      // ja-JP → ja
            tag => tag.split('-')[0] === lang.split('-')[0],        // pt → pt-BR, en-GB → en-US
        ]) {
            const id = known.find(id => matches(id.toLowerCase()));
            if (id) return mapping ? mapping[id] : id;
        }
    }
    return '';
}

/** Store of the active locale: `$locale` to read, `locale.set('fr')` to switch. */
export const locale = { ...store(localeSubscribers, () => current), set: setLocale };

// --- Translation ---

/** Store of the translate function: `$t('key', vars)` in markup. */
export const t = store(tSubscribers, () => tFn);

/** Translate anywhere. Reactive when called from a template, $derived or $effect. */
export function tr(key, vars) {
    track();
    return translate(key, vars);
}

// --- Formatting (Intl, bound to the active locale) ---

export function formatNumber(value, opts, loc) {
    return intl('NumberFormat', opts, loc).format(value);
}

export function formatPercent(value, precision = 0) {
    return formatNumber(value, { style: 'percent', maximumFractionDigits: precision });
}

export function formatDate(value, opts, loc) {
    return intl('DateTimeFormat', opts, loc).format(value);
}

/** Language name for a locale id: its own name by default ('ja' → '日本語'). */
export function localeName(id, displayLocale = id) {
    try {
        return intl('DisplayNames', { type: 'language' }, displayLocale).of(id) || id;
    } catch {
        return id;
    }
}

// --- Internals ---

function translate(key, vars) {
    let value = active?.[key];
    if (value === undefined) {
        if (current) reportMissing(key);
        value = backup?.[key];
        if (value === undefined) {
            // A lazily registered fallback is fetched on the first miss, then the text heals itself.
            if (current && !fallbackTried && !dictionaries[fallback]) {
                fallbackTried = true;
                loadLocale(fallback);
            }
            return key;
        }
    }
    if (vars == null) return value;
    if (typeof value === 'object' && typeof vars.count === 'number') {
        value = value[vars.count] ?? value[intl('PluralRules', undefined, current).select(vars.count)] ?? value.other;
    }
    return typeof value === 'string' ? interpolate(value, vars) : value;
}

function interpolate(text, vars) {
    let open = text.indexOf('{');
    if (open < 0) return text;
    let out = '', last = 0, auto = 0, close;
    while (open >= 0 && (close = text.indexOf('}', open)) >= 0) {
        const value = vars[text.slice(open + 1, close).trim() || auto++];
        if (value != null) {
            out += text.slice(last, open) + value;
            last = close + 1;
        }
        open = text.indexOf('{', close);
    }
    return out + text.slice(last);
}

function flatten(node, prefix, out) {
    for (const key in node) {
        const value = node[key];
        out[prefix + key] = value;
        if (value && typeof value === 'object') flatten(value, prefix + key + '.', out);
    }
}

// Intl objects are slow to construct and fast to reuse, so each one is built once.
function intl(type, opts, loc) {
    if (loc === undefined) {
        track();
        loc = current;
    }
    const cache = formatters[type] ??= new Map();
    const id = opts ? loc + JSON.stringify(opts) : loc;
    let formatter = cache.get(id);
    if (!formatter) {
        try {
            formatter = new Intl[type](loc || undefined, opts);
        } catch {
            formatter = new Intl[type](undefined, opts); // the locale id is not a valid language tag
        }
        cache.set(id, formatter);
    }
    return formatter;
}

// The Svelte store contract, without importing svelte/store.
function store(subscribers, value) {
    return {
        subscribe(fn) {
            subscribers.add(fn);
            fn(value());
            return () => subscribers.delete(fn);
        },
    };
}

function refresh() {
    active = dictionaries[current];
    backup = current === fallback ? undefined : dictionaries[fallback];
    tFn = (key, vars) => translate(key, vars);
    for (const fn of tSubscribers) fn(tFn);
    ping();
}

// true: applied · false: could not load · undefined: superseded by a newer call
function change(next, persist) {
    const id = ++request;
    if (dictionaries[next]) return Promise.resolve(apply(next, persist));
    return loadLocale(next).then(ok => ok && (id === request ? apply(next, persist) : undefined));
}

function apply(next, persist) {
    if (persist) persisted('setItem', next);
    if (next !== current) {
        current = next;
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.lang = next;
            root.dir = RTL.test(next) ? 'rtl' : 'ltr';
        }
        refresh();
        for (const fn of localeSubscribers) fn(next);
    }
    return true;
}

// First candidate that loads wins: stored choice → browser language → initial → fallback.
// Nothing chosen here is persisted; only explicit setLocale() calls are.
async function pick(stored) {
    const detect = options.detect;
    for (const candidate of [
        stored,
        detect !== false && detectLocale(typeof detect === 'object' ? detect : undefined),
        options.initial,
        fallback,
    ]) {
        if (candidate && await change(candidate) !== false) return;
    }
    apply(fallback); // nothing could be loaded: keep a defined locale, keys render as-is
}

// localStorage can be missing or throw (private mode, sandboxed iframes): persistence is best-effort.
function persisted(method, value) {
    try {
        return options.persistKey && localStorage[method](options.persistKey, value);
    } catch { }
}

function reportMissing(key) {
    const onMissing = options.onMissing;
    if (!key || (!warn && !onMissing && !missingListeners.size)) return;
    const seen = missing[current] ??= new Set();
    if (seen.has(key)) return;
    seen.add(key);
    const entry = { locale: current, key };
    if (onMissing) onMissing(entry);
    if (warn) console.warn(`svelte-whisper: Missing "${key}" for locale "${current}"`);
    for (const fn of missingListeners) fn(entry);
}
