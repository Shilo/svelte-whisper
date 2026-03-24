import type { Readable } from "svelte/store";

export type WhisperDictionary = Record<string, unknown>;
export type WhisperVars = Record<string, unknown> | unknown[];

export interface MissingKeyEntry {
    locale: string;
    key: string;
}

export function init(options?: {
    fallback?: string;
    initial?: string;
    persistKey?: string;
    detect?: boolean | Record<string, string>;
    onMissing?: (entry: MissingKeyEntry) => void;
    warn?: boolean;
    devOverlay?: boolean;
}): Promise<void>;

export function addDictionary(
    locale: string,
    dict: WhisperDictionary,
): void;

export function registerLoader(
    locale: string,
    loader: () =>
        | Promise<WhisperDictionary>
        | Promise<{ default: WhisperDictionary }>,
): void;

export function setLocale(locale: string): Promise<void>;

export function resetLocale(): Promise<void>;

export function getLocales(): string[];

export function getFallbackLocale(): string;

export const locale: {
    subscribe: Readable<string>["subscribe"];
    set: (newLocale: string) => Promise<void>;
};

export const t: Readable<(key: string, vars?: WhisperVars) => string>;

export function tr(
    key: string,
    vars?: WhisperVars,
): string;

export function formatNumber(num: number): string;

export function formatPercent(decimal: number, precision?: number): string;

export function getMissingKeys(): MissingKeyEntry[];

export function clearMissingKeys(): void;
