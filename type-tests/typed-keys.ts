// Compile-time checks for index.d.ts. Run with `npm run check:types`; nothing here executes.
import {
    t, tr, locale, init, registerLoader, addDictionary, setLocale, loadLocale, resetLocale,
    getLocale, getLocales, getFallbackLocale, detectLocale, localeName,
    formatNumber, formatPercent, formatDate,
    type WhisperKey, type Translate,
} from 'svelte-whisper';
import type en from './en.json';

// Optional groups and readonly arrays must still expose their paths.
interface Extra {
    optional?: { label: string; list?: readonly string[] };
}

declare module 'svelte-whisper' {
    interface Register {
        dictionary: typeof en & Extra;
    }
}

tr('optional.label');
tr('optional.list.0');
// @ts-expect-error an optional group is still not a message
tr('optional');

// Registered keys: leaves, branches (for plurals and arrays) and array indexes.
tr('greeting', { name: 'Ada' });
tr('nav.settings.title');
tr('items', { count: 3 });
tr('rules.0');
tr('greeting', ['Ada']);
tr('rules');
tr('items.one');
// @ts-expect-error a mistyped key is rejected
tr('nav.hmoe');
// @ts-expect-error a group of messages is not itself a message
tr('nav');
// @ts-expect-error nor is a nested group
tr('nav.settings');
// @ts-expect-error a key is required
tr();

const dynamic = 'nav.home' as string;
tr(dynamic as WhisperKey);

// Stores follow the Svelte contract.
const stopT: () => void = t.subscribe((translate: Translate) => { translate('nav.home') satisfies string; });
const stopLocale: () => void = locale.subscribe((id: string) => id);
locale.set('fr') satisfies Promise<boolean>;
stopT();
stopLocale();

init() satisfies Promise<void>;
init({
    fallback: 'en', initial: 'en', persistKey: 'key', detect: { 'zh-TW': 'zh-Hant' }, warn: false, devOverlay: false,
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
getFallbackLocale() satisfies string;
detectLocale() satisfies string;
detectLocale({ ja: 'jp' }) satisfies string;
localeName('ja') satisfies string;
localeName('ja', 'en') satisfies string;

formatNumber(1) satisfies string;
formatNumber(10n, { style: 'currency', currency: 'EUR' }, 'de') satisfies string;
formatPercent(0.5, 1) satisfies string;
formatDate(new Date(), { dateStyle: 'long' }) satisfies string;
formatDate(0) satisfies string;
// @ts-expect-error not a number
formatNumber('1');
