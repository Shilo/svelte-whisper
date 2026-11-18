---
name: whisper-translate
description: Translate or update the locale JSON files of a svelte-whisper app from its source locale. Use when asked to update, sync, regenerate or fix translations, translate newly added strings, add a new language, or when `svelte-whisper check` reports missing keys.
---

# Translate svelte-whisper locales

The source locale file (usually `en.json`) is the single source of truth for keys, nesting, order and placeholders. Every other locale mirrors it. Translate only what is missing or changed; never rewrite a whole locale file by hand.

All commands are run from the app's root. They need `svelte-whisper` installed in the project.

## Steps

1. **Find the work.**

   ```bash
   npx svelte-whisper check --json
   ```

   Per locale this lists `missing` keys (translate these), `placeholders` and `glossary` mismatches (fix these) and `extra` keys (step 5 removes them). If the command cannot find the locales, pass `--dir <folder> --source <id>`.

2. **Find reworded source strings**, when the source text may have changed since the locales were last translated. Use the last commit that touched a target locale as the reference:

   ```bash
   git log -1 --format=%H -- src/locales/fr.json
   npx svelte-whisper diff --since <that-commit> --json
   ```

   Every key under `changed` needs a fresh translation in every locale. Skip this step when only new keys were added.

3. **Read the project's rules**, if they exist, in the locale folder:
   - `TRANSLATING.md`: tone, audience, brand names, per-language notes.
   - `glossary/<locale>.json`: fixed terms, in the same shape as a locale file. The tools write these values over anything you produce, so do not translate those keys.

4. **Read the source text** of the keys you need:

   ```bash
   npx svelte-whisper keys --json
   ```

5. **Translate and apply, one locale at a time.** Write only the keys from steps 1 and 2 to a temporary JSON file. Dotted keys are fine: `{ "nav.home": "Accueil", "items": { "one": "…", "other": "…" } }`. Then:

   ```bash
   npx svelte-whisper apply fr translations.fr.json
   ```

   `apply` merges your keys, keeps every other existing translation, removes keys that no longer exist in the source, and rewrites the file in source order and indentation. Delete the temporary file afterwards.

6. **Verify.** `npx svelte-whisper check` must exit 0. If it reports a placeholder mismatch, fix that key and apply again.

7. **Report** per locale: keys translated, stale keys removed, glossary terms applied, and anything you were unsure about.

## Adding a language

Run step 5 with the new locale id and a file containing every source key; `apply` creates `<locale>.json`. Use a valid language tag as the id (`pt-BR`, `zh-Hant`), because the file name becomes the locale id. Apps that register `import.meta.glob('./locales/*.json')` pick the new file up automatically; otherwise add a `registerLoader('<id>', () => import('./locales/<id>.json'))` call next to the others.

## Translation rules

- Translate values, never keys.
- Write what a native speaker would write in this product, not a literal rendering. Keep the register consistent with the locale's existing strings.
- Keep every `{placeholder}` exactly as written, including `{}` and `{0}`. Move it wherever the target grammar needs it.
- Keep markup inside strings (`<br>`, `**bold**`, links) intact.
- Leave these identical to the source: values made only of placeholders, numbers or symbols; URLs; brand and product names, unless the project's rules say otherwise.
- **Plurals.** A value such as `{ "one": "{count} item", "other": "{count} items" }` is selected by `Intl.PluralRules`. Give the target language the categories it actually uses: Japanese and Chinese need only `other`; French uses `one`, `many`, `other`; Russian and Polish use `one`, `few`, `many`, `other`; Arabic uses all six. Always include `other`. Exact-number keys such as `"0"` may be kept.
- A sentence must be one key. If the source builds a sentence from several translated fragments, say so in your report instead of translating fragment by fragment: word order and agreement will break in other languages.
- Do not retranslate strings that are already translated unless the source changed or you were asked to improve them.
