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
  svelte-whisper apply <locale> [file]   Merge translations (JSON from file or stdin) into a locale,
                                         then rewrite it in source order without stale keys
  svelte-whisper keys                    Print every source key with its text

Options
  --dir <path>     Locale folder        (default: package.json "svelte-whisper".locales, else auto-detected)
  --source <id>    Source locale        (default: package.json "svelte-whisper".source, else "en")
  --usage <dir>    With check: also scan code for unused and undefined keys
  --json           Machine-readable output
  -h, --help

check exits 1 when a locale has missing keys, extra keys or placeholder mismatches.`;

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
    if (flags.help || !command) return { code: command || flags.help ? 0 : 1, out: HELP };

    const config = readJson(join(cwd, 'package.json'), {})['svelte-whisper'] || {};
    const dir = join(cwd, flags.dir || config.locales || detectDir(cwd));
    const source = flags.source || config.source || 'en';
    const project = { cwd, dir, source, sourceFile: join(dir, source + '.json') };
    if (!existsSync(project.sourceFile)) {
        throw new UsageError(`Source locale not found: ${relative(cwd, project.sourceFile)}\nPass --dir and --source, or set "svelte-whisper": { "locales": "...", "source": "..." } in package.json.`);
    }

    const run = { check, diff, apply, keys }[command];
    if (!run) throw new UsageError(`Unknown command "${command}".\n\n${HELP}`);
    return run(project, flags, args);
}

// --- Commands ---

function check(project, flags) {
    const sourceEntries = flatten(readJson(project.sourceFile));
    const report = { source: project.source, keys: sourceEntries.size, locales: {} };
    let failed = false;

    for (const id of targets(project)) {
        const entries = flatten(readJson(join(project.dir, id + '.json')));
        const result = { missing: [], extra: [], placeholders: [], identical: [] };
        for (const [key, value] of sourceEntries) {
            if (!entries.has(key)) { result.missing.push(key); continue; }
            const want = placeholders(value), got = placeholders(entries.get(key));
            if (want.join() !== got.join()) result.placeholders.push({ key, source: want, [id]: got });
            else if (same(value, entries.get(key)) && /\p{L}{2}/u.test(text(value).replace(/\{[^}]*\}/g, ''))) result.identical.push(key);
        }
        for (const key of entries.keys()) if (!sourceEntries.has(key)) result.extra.push(key);
        failed ||= result.missing.length + result.extra.length + result.placeholders.length > 0;
        report.locales[id] = result;
    }

    if (flags.usage) {
        Object.assign(report, usage(join(project.cwd, flags.usage), sourceEntries));
    }

    if (flags.json) return { code: failed ? 1 : 0, out: JSON.stringify(report, null, 2) };

    const lines = [`Source "${report.source}": ${report.keys} keys`];
    for (const [id, r] of Object.entries(report.locales)) {
        const ok = !r.missing.length && !r.extra.length && !r.placeholders.length;
        lines.push('', `${ok ? '✔' : '✖'} ${id}: ${r.missing.length} missing, ${r.extra.length} extra, ${r.placeholders.length} placeholder mismatches, ${r.identical.length} identical to source`);
        list(lines, 'missing', r.missing);
        list(lines, 'extra (not in source)', r.extra);
        list(lines, 'placeholder mismatch', r.placeholders.map(p => `${p.key}  source {${p.source}} ≠ ${id} {${p[id]}}`));
        list(lines, 'identical to source (untranslated?)', r.identical);
    }
    if (flags.usage) {
        lines.push('', `Code in ${flags.usage}: ${report.unused.length} unused keys, ${report.undefined.length} undefined keys`);
        list(lines, 'unused (in source, never referenced)', report.unused);
        list(lines, 'undefined (referenced, not in source)', report.undefined.map(u => `${u.key}  ${u.file}:${u.line}`));
        if (report.dynamic.length) list(lines, 'dynamic prefixes treated as used', report.dynamic);
    }
    return { code: failed ? 1 : 0, out: lines.join('\n') };
}

function diff(project, flags) {
    if (!flags.since) throw new UsageError('diff needs --since <git-ref>, for example --since HEAD~5 or --since v1.2.0');
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: project.cwd, encoding: 'utf8' }).trim();
    const path = relative(root, project.sourceFile).replaceAll('\\', '/');
    let before = new Map();
    try {
        before = flatten(JSON.parse(execFileSync('git', ['show', `${flags.since}:${path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })));
    } catch { /* the source file did not exist at that ref: every key is new */ }
    const now = flatten(readJson(project.sourceFile));
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
    const incoming = flatten(JSON.parse(file ? readFileSync(join(project.cwd, file), 'utf8') : readFileSync(0, 'utf8')));
    const sourceText = readFileSync(project.sourceFile, 'utf8');
    const sourceEntries = flatten(JSON.parse(sourceText));
    const targetFile = join(project.dir, id + '.json');
    const existing = existsSync(targetFile) ? flatten(readJson(targetFile)) : new Map();

    const unknown = [...incoming.keys()].filter(key => !sourceEntries.has(key));
    if (unknown.length) throw new UsageError(`Not in the source locale, so not applied: ${unknown.join(', ')}`);

    // Rebuild in source order: new translation, else the existing one, else leave the key out
    // so it stays visibly missing instead of silently shipping source text.
    const result = { applied: 0, kept: 0, missing: [], removed: [...existing.keys()].filter(key => !sourceEntries.has(key)) };
    for (const key of sourceEntries.keys()) {
        if (incoming.has(key)) result.applied++;
        else if (existing.has(key)) result.kept++;
        else result.missing.push(key);
    }
    const out = rebuild(JSON.parse(sourceText), '', key => incoming.get(key) ?? existing.get(key));
    const indent = sourceText.match(/^[ \t]+/m)?.[0] ?? '  ';
    writeFileSync(targetFile, JSON.stringify(out, null, indent) + '\n');

    if (flags.json) return { code: 0, out: JSON.stringify(result, null, 2) };
    const lines = [`${id}: ${result.applied} applied, ${result.kept} kept, ${result.removed.length} stale removed, ${result.missing.length} still missing`];
    list(lines, 'still missing', result.missing);
    return { code: 0, out: lines.join('\n') };
}

function keys(project, flags) {
    const entries = flatten(readJson(project.sourceFile));
    if (flags.json) return { code: 0, out: JSON.stringify(Object.fromEntries(entries), null, 2) };
    return { code: 0, out: [...entries].map(([key, value]) => `${key}\t${text(value)}`).join('\n') };
}

// --- Helpers ---

// Leaves keyed by dotted path. A plural object ({ one, other, … }) counts as one leaf, because
// languages need different plural categories and so must not be compared category by category.
export function flatten(node, prefix = '', out = new Map()) {
    for (const [key, value] of Object.entries(node)) {
        const path = prefix + key;
        if (value && typeof value === 'object' && !isPlural(value)) flatten(value, path + '.', out);
        else out.set(path, value);
    }
    return out;
}

function isPlural(value) {
    const names = Object.keys(value);
    return !Array.isArray(value) && 'other' in value && names.every(name => PLURAL.test(name));
}

// A copy of the source's shape holding the target's values; keys without a value are left out.
function rebuild(node, prefix, valueOf) {
    const out = Array.isArray(node) ? [] : {};
    for (const [key, value] of Object.entries(node)) {
        const path = prefix + key;
        const next = value && typeof value === 'object' && !isPlural(value)
            ? rebuild(value, path + '.', valueOf)
            : valueOf(path);
        if (next !== undefined && (typeof next !== 'object' || Object.keys(next).length)) out[key] = next;
    }
    return out;
}

const text = value => typeof value === 'string' ? value : JSON.stringify(value);
const same = (a, b) => text(a) === text(b);

function placeholders(value) {
    return [...new Set(text(value).match(/\{[^{}"]*\}/g) || [])].sort();
}

function usage(dir, sourceEntries) {
    if (!existsSync(dir)) throw new UsageError(`--usage folder not found: ${dir}`);
    const used = new Set(), prefixes = new Set(), undefinedKeys = [];
    const call = /(?:\$t|\btr|\bt)\(\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g;
    const literal = /'([^'\n]+)'|"([^"\n]+)"|`([^`\n]+)`/g;
    for (const file of walk(dir)) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
            // Keys are often kept in data (`{ label: 'nav.home' }`) and translated elsewhere,
            // so any string literal that is exactly a source key counts as a use.
            for (const match of line.matchAll(literal)) {
                const value = match[1] ?? match[2] ?? match[3];
                if (sourceEntries.has(value)) used.add(value);
            }
            for (const match of line.matchAll(call)) {
                const key = match[1] ?? match[2] ?? match[3];
                if (match[3]?.includes('${')) prefixes.add(key.slice(0, key.indexOf('${')));
                else if (sourceEntries.has(key) || [...sourceEntries.keys()].some(k => k.startsWith(key + '.'))) used.add(key);
                else undefinedKeys.push({ key, file: relative(process.cwd(), file).replaceAll('\\', '/'), line: index + 1 });
            }
        });
    }
    const isUsed = key => used.has(key)
        || [...used].some(u => key.startsWith(u + '.'))
        || [...prefixes].some(p => key.startsWith(p));
    return {
        unused: [...sourceEntries.keys()].filter(key => !isUsed(key)),
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
        return JSON.parse(readFileSync(file, 'utf8'));
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
        if (!(error instanceof UsageError) && error.code !== 'ERR_PARSE_ARGS_UNKNOWN_OPTION') throw error;
        console.error(error.message);
        process.exitCode = 2;
    }
}
