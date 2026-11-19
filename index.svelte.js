// svelte-whisper — tiny runtime i18n for Svelte 5 single-page apps.

// Registries have no prototype, so ids and keys such as "constructor" are just strings.
const blank = () => Object.create(null);

// Dictionaries are stored flattened to their messages, so `a.b.c` is a single property lookup.
const dictionaries = blank();
const loaders = blank();
const loaded = blank();
const pending = blank();
const formatters = blank();
const missingListeners = new Set();
// Legacy components (`export let`, `$:`) cannot follow a signal, only a store: `t`, `locale` and the formatters are stores too.
const subscribers = new Set();

// The only reactive state. t(), getLocale() and the formatters read it, so markup, $derived and
// $effect that call them re-run when the locale or a dictionary changes. Everything else is plain data.
let version = $state(0);
let stamp = 0;

let current = '';
let fallback = 'en';
let options = {};
let warn = true;
let request = 0;
let fallbackTried = false;
let missing = blank();
let active, backup;

// Vite replaces import.meta.env.* at build time; elsewhere the lookup throws and '/' stays.
let base = '/';
try { base = import.meta.env.BASE_URL || base; } catch { }

// --- Setup ---

export async function init(opts = {}) {
    options = opts;
    fallback = opts.fallback || 'en';
    warn = opts.warn ?? !opts.onMissing;
    fallbackTried = false;
    missing = blank();
    refresh();
    await pick(persisted('getItem'));

    // Dev overlay: a separate chunk, requested only by the Vite dev server.
    // In production builds this whole branch is removed.
    try {
        if (import.meta.env.DEV && opts.devOverlay !== false && !navigator.webdriver) {
            import('./dev-overlay.js').then(m => m.mount({
                keys: () => Object.keys(missing).flatMap(locale => [...missing[locale]].map(key => ({ locale, key }))),
                listen: fn => missingListeners.add(fn),
                clear() { missing = blank(); },
            })).catch(() => { });
        }
    } catch { }
}

export function addDictionary(locale, dict) {
    flatten(dict, '', dictionaries[locale] ??= blank());
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
    if (ready(locale)) return Promise.resolve(true);
    return pending[locale] ??= (async () => {
        const loader = loaders[locale];
        try {
            let dict;
            if (loader) {
                dict = await loader();
                // `import('./fr.json')` resolves to a module: its dictionary is the default export.
                if (dict?.[Symbol.toStringTag] === 'Module') dict = dict.default;
            } else if (!Object.keys(loaders).length) {
                // Zero-config: with no loaders registered, locales are fetched by convention.
                const response = await fetch(`${base}locales/${locale}.json`);
                if (response.ok) dict = await response.json();
            }
            if (dict && typeof dict === 'object' && !Array.isArray(dict)) {
                // Anything added with addDictionary() stays on top of the loaded file.
                dictionaries[locale] = Object.assign(flatten(dict, '', blank()), dictionaries[locale]);
                if (loader) loaded[locale] = true;
                if (locale === current || locale === fallback) refresh();
                return true;
            }
        } catch (error) {
            console.error(`svelte-whisper: Failed to load locale "${locale}"`, error);
        }
        return false;
        // Cleared once settled, so a failed load can be retried.
    })().finally(() => { delete pending[locale]; });
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

/** The active locale. Reactive. */
export function getLocale() {
    // The result depends on the signal on purpose: a minifier that runs before the Svelte plugin
    // (as in Vite 5 and 6.0) removes a read whose value is unused, and with it the reactivity.
    return version < 0 ? '' : current;
}

export function getLocales() {
    return Object.keys({ ...loaders, ...dictionaries });
}

/** Best match for the browser's preferred languages among known locales, or ''. */
export function detectLocale() {
    if (typeof navigator === 'undefined') return '';
    for (const tag of [...navigator.languages || [], navigator.language || '']) {
        const want = expand(tag);
        let best, rank = 0;
        for (const id of getLocales()) {
            const have = expand(id);
            // Same language in the same script: zh-TW is Hant, so it matches zh-Hant and never zh-Hans.
            if (want && have?.language === want.language && have.script === want.script) {
                // Then: the very id, the same region, a locale without a region, any other region.
                const region = new Intl.Locale(id).region;
                const score = id.toLowerCase() === tag.toLowerCase() ? 4 : !region ? 2 : region === want.region ? 3 : 1;
                if (score > rank) rank = score, best = id;
            }
        }
        if (best) return best;
    }
    return '';
}

// --- Translation ---

/**
 * Translate. Always returns a string. Reactive: `{t('key', vars)}` in markup, or inside $derived and $effect.
 * In a legacy component (`export let`, `$:`), write `{$t('key', vars)}`: `t` is also a store of itself.
 */
export const t = /* @__PURE__ */ storeOf(function t(key, vars) {
    let value = find(active, key, vars, getLocale()); // getLocale() makes t() reactive
    if (value === undefined) {
        if (current) reportMissing(key);
        value = find(backup, key, vars, fallback);
        if (value === undefined) {
            // A lazily registered fallback is fetched on the first miss, then the text heals itself.
            if (current && !fallbackTried && !ready(fallback)) {
                fallbackTried = true;
                loadLocale(fallback);
            }
            return key;
        }
    }
    value = '' + value; // a number or boolean in the JSON becomes text
    return vars == null ? value : interpolate(value, vars);
});

/** The active locale as a store, for legacy components: `$locale`, `bind:value={$locale}`. */
export const locale = /* @__PURE__ */ storeOf({ set: setLocale }, () => current);

// --- Formatting (Intl, bound to the active locale) ---
// Like `t`, each formatter is also a store of itself: `{$formatNumber(n)}` in a legacy component.
// The annotations let an app that imports none of them drop all three.

export const formatNumber = /* @__PURE__ */ storeOf(function formatNumber(value, opts, loc) {
    return intl('NumberFormat', opts, loc).format(value);
});

/** 0.256 → '26%'. `precision` is the maximum number of decimals. */
export const formatPercent = /* @__PURE__ */ storeOf(function formatPercent(value, precision = 0, loc) {
    return formatNumber(value, { style: 'percent', maximumFractionDigits: precision }, loc);
});

export const formatDate = /* @__PURE__ */ storeOf(function formatDate(value, opts, loc) {
    return intl('DateTimeFormat', opts, loc).format(value);
});

/** Language name for a locale id: its own name by default ('ja' → '日本語'). */
export function localeName(id, displayLocale = id) {
    try {
        return intl('DisplayNames', { type: 'language' }, displayLocale).of(id) || id;
    } catch {
        return id;
    }
}

// --- Internals ---

// The message at `key`. For a plural group (`key.one`, `key.other`, …) the form that fits
// vars.count: an exact number first, then the language's plural category, then `other`.
function find(dict, key, vars, locale) {
    let value = dict?.[key];
    if (value === undefined && dict?.[key + '.other'] !== undefined) {
        const count = vars?.count;
        if (typeof count === 'number') {
            value = dict[key + '.' + count] ?? dict[key + '.' + intl('PluralRules', undefined, locale).select(count)];
        }
        value ??= dict[key + '.other'];
    }
    return value;
}

function interpolate(text, vars) {
    let open = text.indexOf('{');
    if (open < 0) return text;
    let out = '', last = 0, close;
    while (open >= 0 && (close = text.indexOf('}', open)) >= 0) {
        const name = text.slice(open + 1, close).trim();
        const value = Object.hasOwn(vars, name) ? vars[name] : null; // never something inherited, like {constructor}
        if (value != null) {
            out += text.slice(last, open) + String(value);
            last = close + 1;
        }
        open = text.indexOf('{', close);
    }
    return out + text.slice(last);
}

function flatten(node, prefix, out) {
    for (const key in node) {
        const value = node[key];
        if (value == null) continue; // a null in JSON reads as "not translated yet"
        if (typeof value === 'object') flatten(value, prefix + key + '.', out);
        else out[prefix + key] = value;
    }
    return out;
}

// A locale with a loader is ready once the loader has delivered: translations added with
// addDictionary() sit on top of it and never stand in for it. Without a loader, having a dictionary is enough.
function ready(locale) {
    return loaders[locale] ? loaded[locale] : dictionaries[locale];
}

// Intl objects are slow to construct and fast to reuse, so each one is built once.
function intl(type, opts, loc = getLocale()) {
    const cache = formatters[type] ??= new Map();
    const id = opts ? loc + JSON.stringify(opts) : loc;
    let formatter = cache.get(id);
    if (!formatter) {
        try {
            formatter = new Intl[type](loc || undefined, opts);
        } catch {
            formatter = new Intl[type](undefined, opts); // the locale id is not a valid language tag
        }
        if (cache.size > 200) cache.clear(); // options built at runtime must not grow it without limit
        cache.set(id, formatter);
    }
    return formatter;
}

// Makes `value` a Svelte store: `subscribe` calls back now and on every change, and returns an
// unsubscribe function. A function becomes a store of itself, so `$fn(…)` re-runs on a change.
function storeOf(value, read = () => value) {
    value.subscribe = fn => {
        const run = () => fn(read());
        subscribers.add(run);
        run();
        return () => subscribers.delete(run);
    };
    return value;
}

function refresh() {
    active = dictionaries[current];
    backup = current === fallback ? undefined : dictionaries[fallback];
    // Written from a plain counter, never read back, so calling this inside an effect
    // does not make that effect depend on (and re-run from) its own change.
    version = ++stamp;
    for (const run of subscribers) run();
}

// true: applied · false: could not load · undefined: superseded by a newer call
function change(next, persist) {
    const id = ++request;
    if (ready(next)) return Promise.resolve(apply(next, persist));
    // While the first language downloads, a fallback already in memory is the active locale,
    // so an app that mounts before the file arrives has a real locale and switches when it comes.
    if (!current && ready(fallback)) apply(fallback);
    return loadLocale(next).then(ok => id === request ? ok && apply(next, persist) : undefined);
}

function apply(next, persist) {
    if (persist) persisted('setItem', next);
    if (next !== current) {
        current = next;
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.lang = next;
            root.dir = /^(Arab|Hebr|Thaa|Syrc|Nkoo|Adlm|Rohg)$/.test(expand(next)?.script) ? 'rtl' : 'ltr';
        }
        refresh();
    }
    return true;
}

// What a language tag implies, from the platform: `pt` is pt-Latn-BR, `fa` is fa-Arab-IR.
// Undefined for an id that is not a language tag.
function expand(tag) {
    try {
        return new Intl.Locale(tag).maximize();
    } catch { }
}

// First candidate that loads wins: stored choice → browser language → initial → fallback.
// Nothing chosen here is persisted; only explicit setLocale() calls are.
async function pick(stored) {
    // A Set: when several of them name the same locale, it is tried once.
    for (const candidate of new Set([stored, options.detect !== false && detectLocale(), options.initial, fallback])) {
        if (!candidate) continue;
        const mine = request + 1;
        // Stop on success, and also when a newer setLocale() took over while this one was loading.
        if (await change(candidate) !== false || request !== mine) return;
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
    if (warn) console.warn(`svelte-whisper: Missing "${key}" for locale "${current}"`);
    for (const fn of missingListeners) fn(entry);
    if (onMissing) onMissing(entry);
}
