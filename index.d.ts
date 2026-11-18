/**
 * Register your source dictionary to get autocompleted, type-checked keys.
 * Costs nothing at runtime.
 *
 * ```ts
 * import type en from './locales/en.json';
 *
 * declare module 'svelte-whisper' {
 *     interface Register {
 *         dictionary: typeof en;
 *     }
 * }
 * ```
 */
export interface Register {}

// Every path that holds a message: leaves, plural groups ({ one, other, … }) and the items of lists.
// A plain group such as `nav`, or a list itself, is not a message, so it is not a key.
type Paths<T, P extends string = ''> = {
    [K in keyof T & string]: Message<NonNullable<T[K]>, `${P}${K}`>;
}[keyof T & string];

type Message<V, P extends string> = V extends readonly (infer U)[]
    ? Message<NonNullable<U>, `${P}.${number}`>
    : V extends object
      ? (V extends { other: string | number | boolean } ? P : never) | Paths<V, `${P}.`>
      : P;

/** A translation key: any string, or the message paths of the registered dictionary. */
export type WhisperKey = Register extends { dictionary: infer D } ? Paths<D> : string;

export type WhisperDictionary = Record<string, unknown>;

/** Values for named placeholders (`{ user: 'Ada' }` for `{user}`) or indexed ones (`['Ada']` for `{0}`). */
export type WhisperVars = Record<string, unknown> | readonly unknown[];

export type WhisperLoader = () => Promise<unknown>;

export type Translate = (key: WhisperKey, vars?: WhisperVars) => string;

export interface MissingKeyEntry {
    locale: string;
    key: string;
}

export interface WhisperOptions {
    /** Locale used when a key is missing from the active one. Default `'en'`. */
    fallback?: string;
    /** Starting locale when nothing is stored and nothing is detected. */
    initial?: string;
    /** localStorage key that remembers the user's explicit choice. */
    persistKey?: string;
    /** Start in the browser's language when one of your locales matches it. Default `true`. */
    detect?: boolean;
    /** Called once per locale + key that is missing from the active locale. */
    onMissing?: (entry: MissingKeyEntry) => void;
    /** `console.warn` on missing keys. Default `true` unless `onMissing` is set. */
    warn?: boolean;
    /** Missing-key panel in Vite dev mode. Default `true`; never part of a production build. */
    devOverlay?: boolean;
}

/**
 * Choose the starting locale (stored choice → browser language → `initial` → `fallback`)
 * and load its dictionary.
 */
export function init(options?: WhisperOptions): Promise<void>;

/** Merge translations into a locale that is already in memory, such as a bundled default. */
export function addDictionary(locale: string, dict: WhisperDictionary): void;

/**
 * Register a lazy loader: it resolves to a dictionary, or to the module of one
 * (`() => import('./fr.json')`). It runs the first time the locale is needed.
 */
export function registerLoader(locale: string, loader: WhisperLoader): void;
/**
 * Register every file of a glob, using each file name as the locale id:
 * `registerLoader(import.meta.glob('./locales/*.json'))`.
 */
export function registerLoader(loaders: Record<string, WhisperLoader>): void;

/** Load a locale without switching to it. Resolves `false` if it could not be loaded. */
export function loadLocale(locale: string): Promise<boolean>;

/**
 * Switch locale, loading it first if needed, and remember the choice when `persistKey` is set.
 * Resolves `true` once active, `false` if loading failed or a newer call won.
 */
export function setLocale(locale: string): Promise<boolean>;

/** Forget the stored choice and choose again as `init` did. */
export function resetLocale(): Promise<void>;

/** The active locale. Reactive: use it in markup, `$derived` and `$effect`. */
export function getLocale(): string;

/** Every locale with a loader or a dictionary. */
export function getLocales(): string[];

/** The known locale that best matches the browser's languages, or `''`. */
export function detectLocale(): string;

interface Subscribable<T> {
    subscribe(run: (value: T) => void): () => void;
}

/**
 * Translate. Always returns a string: the message, or the key itself when there is none.
 * Reactive: `{t('key', vars)}` in markup, or inside `$derived` and `$effect`, updates when the
 * locale or a dictionary changes.
 *
 * In a legacy component (one that uses `export let`, `$:`, `$$props` or `$$restProps`, or has runes switched off),
 * Svelte only follows stores, so write `{$t('key', vars)}`: `t` is also a store of itself.
 */
export const t: Translate & Subscribable<Translate>;

/**
 * The active locale as a store, for legacy components (`export let`, `$:`): `{$locale}`,
 * `bind:value={$locale}`, `formatNumber(n, undefined, $locale)`. In runes code use
 * `getLocale()` and `setLocale()`.
 */
export const locale: Subscribable<string> & { set: (locale: string) => Promise<boolean> };

/** `Intl.NumberFormat` for the active locale (or `locale`). Reactive unless `locale` is given. */
export function formatNumber(
    value: number | bigint,
    options?: Intl.NumberFormatOptions,
    locale?: string,
): string;

/**
 * A fraction as a percentage: `formatPercent(0.256)` → `26%`, `formatPercent(0.256, 1)` → `25.6%`.
 * `precision` is the maximum number of decimals. Reactive unless `locale` is given.
 */
export function formatPercent(value: number, precision?: number, locale?: string): string;

/** `Intl.DateTimeFormat` for the active locale (or `locale`). Reactive unless `locale` is given. */
export function formatDate(
    value: Date | number,
    options?: Intl.DateTimeFormatOptions,
    locale?: string,
): string;

/**
 * The language name of a locale id, in its own language by default
 * (`localeName('ja')` → `日本語`) or in `displayLocale`.
 */
export function localeName(locale: string, displayLocale?: string): string;
