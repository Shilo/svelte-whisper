---
name: whisper-audit
description: Audit the translations of a svelte-whisper app for missing, extra, unused and undefined keys, placeholder mismatches and untranslated strings. Use when asked to check, validate or clean up translations or locale files, to find unused i18n keys, or before a release.
---

# Audit svelte-whisper locales

Run from the app's root, with `svelte-whisper` installed:

```bash
npx svelte-whisper check --usage src
```

Add `--json` when you want to process the result. Pass `--dir <folder> --source <id>` if the locales are not found. The command exits 1 when a locale has missing keys, extra keys, placeholder mismatches or ignored glossary terms.

## Reading the report

| Finding | Meaning | Fix |
|---|---|---|
| `missing` | In the source locale, not in this one. Users see the fallback language. | Translate it with the `whisper-translate` skill. |
| `extra` | In this locale, not in the source. Dead weight in the download. | `npx svelte-whisper sync` |
| `placeholder mismatch` | The translation dropped, renamed or invented a `{placeholder}`. The value will render wrongly. | Correct the translation. |
| `differs from the glossary` | A fixed term in `glossary/<locale>.json` was overwritten. | `npx svelte-whisper sync` |
| `identical to source` | Same text as the source. Often a brand name or an untranslated string. | Review; translate the real ones. Not an error. |
| `undefined` | Code references a key that is not in the source locale. Users see the raw key. | Fix the typo or add the key to the source, then translate. |
| `unused` | A source key that no code references. | Confirm, then delete it from the source and run `npx svelte-whisper sync`. |

## Before deleting an unused key

The scan is static. It counts a key as used when code calls `$t`, `tr` or `t` with it, or contains it as a string literal, and it treats everything under a dynamic key such as `` $t(`skills.${id}`) `` as used. It cannot see keys built another way, for example by concatenation, read from a server, or assembled from a variable prefix. Search the code for the key's last segment before deleting it, and keep the key when in doubt.

## Report

Summarise the counts per locale, list what you fixed, and list what needs a human decision: suspicious `identical` strings, `unused` keys you kept, and any sentence the app builds from several translated fragments.
