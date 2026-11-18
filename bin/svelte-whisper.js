#!/usr/bin/env node
// svelte-whisper locale tools. Zero dependencies; never part of an app bundle.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, extname, relative } from 'node:path';
import { parseArgs } from 'node:util';

const HELP = `svelte-whisper — locale tools

Usage
  svelte-whisper check [--usage <dir>]   Compare every locale with the source locale
  svelte-whisper diff --since <git-ref>  List source keys added, changed or removed since a commit
  svelte-whisper apply <locale> [file]   Merge translations (JSON from a file or stdin) into a locale
  svelte-whisper sync                    Rewrite every locale in source order, dropping stale keys
  svelte-whisper keys                    Print every source key with its text

Options
  --dir <path>     Locale folder   (default: package.json "svelte-whisper".locales, else auto-detected)
  --source <id>    Source locale   (default: package.json "svelte-whisper".source, else "en")
  --usage <dir>    With check: also scan code for unused and undefined keys
  --json           Machine-readable output
  -h, --help

A glossary at <locale folder>/glossary/<locale>.json holds fixed terms in the same shape as a
locale file. apply and sync write its values over anything else; check fails when one is ignored.

check exits 1 on missing keys, extra keys, placeholder mismatches or ignored glossary terms,
and with --usage also when code uses a key that the source locale does not have.`;

const PLURAL = /^(zero|one|two|few|many|other|\d+)$/;
const CODE = new Set(['.svelte', '.js', '.ts', '.mjs', '.jsx', '.tsx']);
const SKIP = new Set(['node_modules', 'dist', 'build', '.svelte-kit', '.git']);

class UsageError extends Error { }

export function main(argv, cwd = process.cwd()) {
    const { values: flags, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            dir: { type: 'string' },
            source: { type: 'string' },
            usage: { type: 'string' },
            since: { type: 'string' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    const [command, ...args] = positionals;
    if (flags.help || !command) return { code: flags.help ? 0 : 1, out: HELP };

    const config = readJson(join(cwd, 'package.json'), {})['svelte-whisper'] || {};
    const dir = join(cwd, flags.dir || config.locales || detectDir(cwd));
    const source = flags.source || config.source || 'en';
    const project = { cwd, dir, source, sourceFile: join(dir, source + '.json') };
    if (!existsSync(project.sourceFile)) {
        throw new UsageError(
            `Source locale not found: ${relative(cwd, project.sourceFile)}\n` +
            'Pass --dir and --source, or set "svelte-whisper": { "locales": "...", "source": "..." } in package.json.',
        );
    }

    const run = { check, diff, apply, sync, keys }[command];
    if (!run) throw new UsageError(`Unknown command "${command}".\n\n${HELP}`);
    return run(project, flags, args);
}

// --- Commands ---

function check(project, flags) {
    const source = flatten(readLocale(project.sourceFile));
    const report = { source: project.source, keys: source.size, locales: {} };
    let failed = false;

    for (const id of targets(project)) {
        const entries = localeEntries(project, id);
        const terms = glossary(project, id);
        const result = { missing: [], extra: [], placeholders: [], glossary: [], identical: [] };
        for (const [key, value] of source) {
            if (!entries.has(key)) {
                result.missing.push(key);
                continue;
            }
            const translated = entries.get(key);
            const want = placeholders(value), got = placeholders(translated);
            if (want.join() !== got.join()) result.placeholders.push({ key, source: want, [id]: got });
            else if (terms.has(key) && !same(terms.get(key), translated)) result.glossary.push(key);
            else if (!terms.has(key) && same(value, translated) && hasWords(value)) result.identical.push(key);
        }
        for (const key of entries.keys()) if (!source.has(key)) result.extra.push(key);
        failed ||= result.missing.length + result.extra.length + result.placeholders.length + result.glossary.length > 0;
        report.locales[id] = result;
    }

    if (flags.usage) {
        Object.assign(report, usage(project, join(project.cwd, flags.usage), source));
        // A key the code asks for but no file has is shown to users as a raw key.
        failed ||= report.undefined.length > 0;
    }
    if (flags.json) return { code: failed ? 1 : 0, out: JSON.stringify(report, null, 2) };

    const lines = [`Source "${report.source}": ${report.keys} keys`];
    for (const [id, r] of Object.entries(report.locales)) {
        const ok = !(r.missing.length + r.extra.length + r.placeholders.length + r.glossary.length);
        lines.push('', `${ok ? '✔' : '✖'} ${id}: ${r.missing.length} missing, ${r.extra.length} extra, ` +
            `${r.placeholders.length} placeholder mismatches, ${r.identical.length} identical to source`);
        list(lines, 'missing', r.missing);
        list(lines, 'extra (not in source)', r.extra);
        list(lines, 'placeholder mismatch', r.placeholders.map(p => `${p.key}  source ${p.source.join(' ') || 'none'} ≠ ${id} ${p[id].join(' ') || 'none'}`));
        list(lines, 'differs from the glossary', r.glossary);
        list(lines, 'identical to source (untranslated?)', r.identical);
    }
    if (flags.usage) {
        lines.push('', `Code in ${flags.usage}: ${report.unused.length} unused keys, ${report.undefined.length} undefined keys`);
        list(lines, 'unused (in source, never referenced)', report.unused);
        list(lines, 'undefined (referenced, not in source)', report.undefined.map(u => `${u.key}  ${u.file}:${u.line}`));
        list(lines, 'dynamic keys, everything under them counts as used', report.dynamic);
    }
    return { code: failed ? 1 : 0, out: lines.join('\n') };
}

function diff(project, flags) {
    if (!flags.since) throw new UsageError('diff needs --since <git-ref>, for example --since HEAD~5 or --since v1.2.0');
    const git = (...args) => execFileSync('git', args, { cwd: project.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const path = relative(git('rev-parse', '--show-toplevel').trim(), realpathSync(project.sourceFile)).replaceAll('\\', '/');
    let before = new Map();
    try {
        before = flatten(JSON.parse(git('show', `${flags.since}:${path}`)));
    } catch { /* the source file did not exist at that ref: every key is new */ }

    const now = flatten(readLocale(project.sourceFile));
    const report = { since: flags.since, added: [], changed: [], removed: [] };
    for (const [key, value] of now) {
        if (!before.has(key)) report.added.push(key);
        else if (!same(before.get(key), value)) report.changed.push(key);
    }
    for (const key of before.keys()) if (!now.has(key)) report.removed.push(key);

    if (flags.json) return { code: 0, out: JSON.stringify(report, null, 2) };
    const lines = [`Source "${project.source}" since ${flags.since}: ${report.added.length} added, ${report.changed.length} changed, ${report.removed.length} removed`];
    list(lines, 'added', report.added);
    list(lines, 'changed (retranslate)', report.changed);
    list(lines, 'removed', report.removed);
    return { code: 0, out: lines.join('\n') };
}

function apply(project, flags, [id, file]) {
    if (!id) throw new UsageError('apply needs a locale: svelte-whisper apply fr translations.json');
    if (id === project.source) throw new UsageError(`"${id}" is the source locale; edit ${basename(project.sourceFile)} directly.`);
    let incoming;
    try {
        const input = file ? readFileSync(join(project.cwd, file), 'utf8') : readFileSync(0, 'utf8');
        incoming = flatten(dictionary(JSON.parse(input.replace(/^\uFEFF/, '')), file || 'stdin'));
    } catch (error) {
        throw error instanceof UsageError ? error : new UsageError(`${file || 'stdin'}: ${error.message}`);
    }
    return summary(flags, { [id]: write(project, id, incoming) });
}

function sync(project, flags) {
    const ids = targets(project);
    // Read everything first: an unreadable file must stop the run before anything is rewritten.
    flatten(readLocale(project.sourceFile));
    for (const id of ids) localeEntries(project, id);
    return summary(flags, Object.fromEntries(ids.map(id => [id, write(project, id, new Map())])));
}

function keys(project, flags) {
    const entries = flatten(readLocale(project.sourceFile));
    if (flags.json) return { code: 0, out: JSON.stringify(Object.fromEntries(entries), null, 2) };
    return { code: 0, out: [...entries].map(([key, value]) => `${key}\t${text(value)}`).join('\n') };
}

// --- Helpers ---

// Rewrites a locale in the source's shape and order. Value priority: glossary, new translation,
// existing translation. A key with none of them is left out, so it stays visibly missing
// instead of silently shipping source text.
function write(project, id, incoming) {
    const sourceText = readFileSync(project.sourceFile, 'utf8');
    const sourceJson = readLocale(project.sourceFile);
    const source = flatten(sourceJson);
    const existing = localeEntries(project, id);
    const terms = glossary(project, id);

    // An emptied or truncated source would otherwise erase every translation.
    if (!source.size) throw new UsageError(`${basename(project.sourceFile)} has no keys, so nothing was rewritten.`);
    const unknown = [...incoming.keys()].filter(key => !source.has(key));
    if (unknown.length) throw new UsageError(`Not in the source locale, so not applied: ${unknown.join(', ')}`);

    const result = { applied: 0, kept: 0, glossary: 0, removed: [...existing.keys()].filter(key => !source.has(key)), missing: [] };
    for (const key of source.keys()) {
        if (terms.has(key)) result.glossary++;
        else if (incoming.has(key)) result.applied++;
        else if (existing.has(key)) result.kept++;
        else result.missing.push(key);
    }
    const out = rebuild(sourceJson, '', key => terms.get(key) ?? incoming.get(key) ?? existing.get(key));
    const indent = sourceText.match(/^[ \t]+/m)?.[0] ?? '  ';
    // Keep the line endings the file already has (or the source's, for a new file).
    const targetFile = join(project.dir, id + '.json');
    const eol = (existsSync(targetFile) ? readFileSync(targetFile, 'utf8') : sourceText).includes('\r\n') ? '\r\n' : '\n';
    writeFileSync(targetFile, (JSON.stringify(out, null, indent) + '\n').replaceAll('\n', eol));
    return result;
}

function summary(flags, results) {
    if (flags.json) return { code: 0, out: JSON.stringify(results, null, 2) };
    const lines = [];
    for (const [id, r] of Object.entries(results)) {
        lines.push(`${id}: ${r.applied} applied, ${r.kept} kept, ${r.glossary} from glossary, ${r.removed.length} stale removed, ${r.missing.length} still missing`);
        list(lines, 'still missing', r.missing);
    }
    return { code: 0, out: lines.join('\n') };
}

// Leaves keyed by dotted path. A plural object ({ one, other, … }) counts as one leaf, because
// languages need different plural categories and so cannot be compared category by category.
export function flatten(node, prefix = '', out = new Map()) {
    for (const [key, value] of Object.entries(node)) {
        const path = prefix + key;
        if (value == null) continue;
        if (isGroup(value)) {
            flatten(value, path + '.', out);
            continue;
        }
        // { "a": { "b": … }, "a.b": … } names one message twice; rewriting it would lose one of them.
        if (out.has(path)) throw new UsageError(`"${path}" is defined twice, once nested and once as a dotted key. Keep one.`);
        out.set(path, value);
    }
    return out;
}

// Something to descend into. Plural objects and empty arrays or objects are values in their own right.
function isGroup(value) {
    return typeof value === 'object' && !isPlural(value) && Object.keys(value).length > 0;
}

// A copy of the source's shape holding the target's values; keys without a value are left out.
function rebuild(node, prefix, valueOf) {
    // No prototype, so a key named "__proto__" is written as an ordinary property.
    const out = Array.isArray(node) ? [] : Object.create(null);
    for (const [key, value] of Object.entries(node)) {
        const path = prefix + key;
        if (value == null) continue;
        if (isGroup(value)) {
            const group = rebuild(value, path + '.', valueOf);
            if (Object.keys(group).length) out[key] = group;
        } else {
            const leaf = valueOf(path);
            if (leaf !== undefined) out[key] = leaf;
        }
    }
    return out;
}

function isPlural(value) {
    return !Array.isArray(value) && 'other' in value && Object.keys(value).every(name => PLURAL.test(name));
}

const text = value => typeof value === 'string' ? value : JSON.stringify(value);
const same = (a, b) => text(a) === text(b);
const hasWords = value => /\p{L}{2}/u.test(text(value).replace(/\{[^{}]*\}/g, ''));
// Named placeholders may repeat; each automatic `{}` is a separate argument, so they are numbered.
function placeholders(value) {
    let auto = 0;
    const found = (text(value).match(/\{[^{}"]*\}/g) || []).map(p => p.slice(1, -1).trim() ? p : `{#${++auto}}`);
    return [...new Set(found)].sort();
}

function localeEntries(project, id) {
    const file = join(project.dir, id + '.json');
    return existsSync(file) ? flatten(readLocale(file)) : new Map();
}

function glossary(project, id) {
    const file = join(project.dir, 'glossary', id + '.json');
    return existsSync(file) ? flatten(readLocale(file)) : new Map();
}

function readLocale(file) {
    return dictionary(readJson(file), file);
}

// A locale file must be a JSON object. Anything else would read as "no keys" and wipe the targets.
function dictionary(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new UsageError(`${name}: a locale file must contain a JSON object.`);
    }
    return value;
}

function usage(project, dir, source) {
    if (!existsSync(dir)) throw new UsageError(`--usage folder not found: ${dir}`);
    const sourceKeys = [...source.keys()];
    const used = new Set(), prefixes = new Set(), undefinedKeys = [];
    const call = /(?<![\w$.])t\(\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g;
    const literal = /'([^'\n]+)'|"([^"\n]+)"|`([^`\n]+)`/g;

    for (const file of walk(dir)) {
        readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
            // Keys are often kept in data (`{ label: 'nav.home' }`) and translated elsewhere,
            // so any string literal that is exactly a source key counts as a use.
            for (const match of line.matchAll(literal)) {
                const value = match[1] ?? match[2] ?? match[3];
                if (source.has(value)) used.add(value);
            }
            for (const match of line.matchAll(call)) {
                const key = match[1] ?? match[2] ?? match[3];
                if (match[3]?.includes('${')) prefixes.add(key.slice(0, key.indexOf('${')));
                else if (sourceKeys.some(k => k === key || k.startsWith(key + '.'))) used.add(key);
                else if (key) undefinedKeys.push({ key, file: relative(project.cwd, file).replaceAll('\\', '/'), line: index + 1 });
            }
        });
    }
    const isUsed = key => used.has(key)
        || [...used].some(u => key.startsWith(u + '.'))
        || [...prefixes].some(p => key.startsWith(p));
    return {
        unused: sourceKeys.filter(key => !isUsed(key)),
        undefined: undefinedKeys,
        dynamic: [...prefixes].sort().map(p => p + '*'),
    };
}

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        if (SKIP.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (CODE.has(extname(name))) yield path;
    }
}

function targets({ dir, source }) {
    return readdirSync(dir)
        .filter(name => name.endsWith('.json') && name !== source + '.json')
        .map(name => name.slice(0, -5))
        .sort();
}

function detectDir(cwd) {
    return ['src/locales', 'src/lib/locales', 'src/i18n', 'public/locales', 'static/locales', 'locales']
        .find(candidate => existsSync(join(cwd, candidate))) || 'src/locales';
}

function readJson(file, missing) {
    if (missing !== undefined && !existsSync(file)) return missing;
    try {
        return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); // tolerate a byte order mark
    } catch (error) {
        throw new UsageError(`${file}: ${error.message}`);
    }
}

function list(lines, title, items) {
    if (!items.length) return;
    lines.push(`  ${title}:`);
    for (const item of items) lines.push(`    ${item}`);
}

// --- Entry ---

// Run only when executed (directly or through the npm bin link), not when imported by tests.
if (process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename) {
    try {
        const { code, out } = main(process.argv.slice(2));
        console.log(out);
        process.exitCode = code;
    } catch (error) {
        if (!(error instanceof UsageError) && !error.code?.startsWith('ERR_PARSE_ARGS')) throw error;
        console.error(error.message);
        process.exitCode = 2;
    }
}
