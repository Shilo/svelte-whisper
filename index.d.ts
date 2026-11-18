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

// Every path that holds a message: leaves, plural groups ({ one, other, … }), arrays and their items.
// A plain group such as `nav` is not a message, so it is not a key.
type Paths<T, P extends string = ''> = {
    [K in keyof T & string]: Message<NonNullable<T[K]>, `${P}${K}`>;
}[keyof T & string];

type Message<V, P extends string> = V extends readonly (infer U)[]
    ? P | (U extends object ? Paths<U, `${P}.${number}.`> : `${P}.${number}`)
    : V extends object
      ? (V extends { other: unknown } ? P : never) | Paths<V, `${P}.`>
      : P;

/** A translation key: any string, or the message paths of the registered dictionary. */
export type WhisperKey = Register extends { dictionary: infer D } ? Paths<D> : string;

export type WhisperDictionary = Record<string, unknown>;

/** Named (`{ user: 'Ada' }`) or positional (`['Ada']`) interpolation values. */
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
    /**
     * Match the browser's languages against known locales. Default `true`.
     * Pass `{ 'zh-TW': 'zh-Hant' }` to map language tags to your own locale ids.
     */
    detect?: boolean | Record<string, string>;
    /** Called once per locale + key that is missing from the active locale. */
    onMissing?: (entry: MissingKeyEntry) => void;
    /** `console.warn` on missing keys. Default `true` unless `onMissing` is set. */
    warn?: boolean;
    /** Missing-key panel in Vite dev mode. Default `true`; never part of a production build. */
    devOverlay?: boolean;
}

interface Subscribable<T> {
    subscribe(run: (value: T) => void): () => void;
}

/**
 * Choose the starting locale (stored choice → browser language → `initial` → `fallback`)
 * and load its dictionary.
 */
export function init(options?: WhisperOptions): Promise<void>;

/** Merge translations into a locale that is already in memory, such as a bundled default. */
export function addDictionary(locale: string, dict: WhisperDictionary): void;

/** Register a lazy loader. It runs once, the first time the locale is needed. */
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

/** The active locale. Reactive in templates, `$derived` and `$effect`. */
export function getLocale(): string;

/** Every locale with a loader or a dictionary. */
export function getLocales(): string[];

export function getFallbackLocale(): string;

/** The known locale that best matches the browser's languages, or `''`. */
export function detectLocale(mapping?: Record<string, string>): string;

/** Store of the active locale: `$locale` to read, `locale.set('fr')` or `$locale = 'fr'` to switch. */
export const locale: Subscribable<string> & {
    set: (locale: string) => Promise<boolean>;
};

/** Store of the translate function: `$t('key', vars)`. */
export const t: Subscribable<Translate>;

/** Translate outside markup. Reactive in templates, `$derived` and `$effect`. */
export const tr: Translate;

/** `Intl.NumberFormat` for the active locale (or `locale`). */
export function formatNumber(
    value: number | bigint,
    options?: Intl.NumberFormatOptions,
    locale?: string,
): string;

/** `0.256` → `26%`. `precision` is the maximum number of fraction digits. */
export function formatPercent(value: number, precision?: number): string;

/** `Intl.DateTimeFormat` for the active locale (or `locale`). */
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
