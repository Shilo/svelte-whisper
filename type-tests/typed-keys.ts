// Compile-time checks for index.d.ts. Run with `npm run check:types`; nothing here executes.
import {
    t, locale, init, registerLoader, addDictionary, setLocale, loadLocale, resetLocale,
    getLocale, getLocales, detectLocale, localeName, formatNumber, formatPercent, formatDate,
    type WhisperKey, type Translate,
} from 'svelte-whisper';
import type en from './en.json';

// Optional groups and readonly arrays must still expose their paths.
interface Extra {
    optional?: { label: string; list?: readonly string[] };
    grid: string[][];
    rows: { cells: string[] }[];
    pending: { other: null };
}

declare module 'svelte-whisper' {
    interface Register {
        dictionary: typeof en & Extra;
    }
}

t('optional.label');
t('grid.0.0');
t('rows.0.cells.1');
// @ts-expect-error a list is not a message; its items are
t('rows');
// @ts-expect-error a plural group whose forms are all untranslated is not a message yet
t('pending');
t('optional.list.0');
// @ts-expect-error an optional group is still not a message
t('optional');

// Registered keys: leaves, branches (for plurals and arrays) and array indexes.
t('greeting', { name: 'Ada' });
t('nav.settings.title');
t('items', { count: 3 });
t('rules.0');
t('greeting', ['Ada']);
// @ts-expect-error a list is not a message; its items are
t('rules');
t('items.one');
// @ts-expect-error a mistyped key is rejected
t('nav.hmoe');
// @ts-expect-error a group of messages is not itself a message
t('nav');
// @ts-expect-error nor is a nested group
t('nav.settings');
// @ts-expect-error a key is required
t();

const dynamic = 'nav.home' as string;
t(dynamic as WhisperKey);

t('greeting') satisfies string;

// Stores, for components without runes.
const stopT: () => void = t.subscribe(translate => { translate('nav.home') satisfies string; });
const stopLocale: () => void = locale.subscribe(id => { id satisfies string; });
locale.set('fr') satisfies Promise<boolean>;
stopT();
stopLocale();
const translate: Translate = t;
translate('nav.home');

init() satisfies Promise<void>;
init({
    fallback: 'en', initial: 'en', persistKey: 'key', detect: false, warn: false, devOverlay: false,
    onMissing: ({ locale, key }) => { locale satisfies string; key satisfies string; },
});
// @ts-expect-error unknown option
init({ fallbackLocale: 'en' });

registerLoader('fr', () => import('./en.json'));
registerLoader('fr', async () => ({ greeting: 'Bonjour' }));
registerLoader({ './locales/fr.json': () => import('./en.json') });
// @ts-expect-error a loader must return a promise
registerLoader('fr', () => ({}));
addDictionary('fr', { greeting: 'Bonjour' });

setLocale('fr') satisfies Promise<boolean>;
loadLocale('fr') satisfies Promise<boolean>;
resetLocale() satisfies Promise<void>;
getLocale() satisfies string;
getLocales() satisfies string[];
detectLocale() satisfies string;
localeName('ja') satisfies string;
localeName('ja', 'en') satisfies string;

formatNumber(1) satisfies string;
formatNumber(10n, { style: 'currency', currency: 'EUR' }, 'de') satisfies string;
formatNumber(0.5, { style: 'percent', maximumFractionDigits: 1 }) satisfies string;
formatPercent(0.5) satisfies string;
formatPercent(0.5, 1, 'fr') satisfies string;
formatDate(new Date(), { dateStyle: 'long' }) satisfies string;
formatDate(0) satisfies string;
// @ts-expect-error not a number
formatNumber('1');

// The `$` forms, typed the way svelte-check types `$store` in a component.
declare function storeGet<T>(store: { subscribe: (run: (value: T) => any, invalidate?: any) => any }): T;
const $t = storeGet(t);
const $locale = storeGet(locale);
const $formatNumber = storeGet(formatNumber);
const $formatPercent = storeGet(formatPercent);
const $formatDate = storeGet(formatDate);
$t('greeting', { name: 'Ada' }) satisfies string;
// @ts-expect-error typed keys still apply through $t
$t('nav.hmoe');
$locale satisfies string;
$formatNumber(1234.5) satisfies string;
$formatNumber(10n, { style: 'currency', currency: 'EUR' }, 'de') satisfies string;
$formatPercent(0.5, 1) satisfies string;
$formatDate(new Date(), { dateStyle: 'long' }) satisfies string;
// @ts-expect-error not a number
$formatNumber('1');
// @ts-expect-error not a date
$formatDate('2026-01-01');
const stopFormat: () => void = formatDate.subscribe(format => { format(0) satisfies string; });
stopFormat();
